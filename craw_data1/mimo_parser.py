"""
MiMo (Xiaomi) LLM fallback parser for the AABW schedule.

This is the FALLBACK path: it only runs when the deterministic JS-bundle parse
(schedule_parser.py) is unavailable — i.e. the React-SPA bundle couldn't be
fetched/extracted or its literal no longer parses. In that case the only source
left is the homepage's unstructured markdown/HTML, where an LLM genuinely beats a
brittle regex (the existing `parse_daily_schedule_events` only handles Day-1).

MiMo exposes an OpenAI-compatible API. We call it with stdlib urllib (no SDK
dep — a heavy cold pip-install in the throwaway crawl container), with:
  - model        = $MIMO_MODEL (default mimo-v2.5)
  - temperature  = 0
  - thinking     = disabled  (so temp 0 actually applies; no reasoning_content)
  - response_format = { type: "json_object" }   (json_schema is unsupported)
  - one attempt, ~20s timeout (no retry storm; 1 call/cycle)

Config (env): MIMO_API_KEY, MIMO_BASE_URL (default token-plan-sgp .../v1),
MIMO_MODEL (default mimo-v2.5).
"""
from __future__ import annotations

import json
import logging
import os
import urllib.request

logger = logging.getLogger(__name__)

MIMO_BASE_URL = os.environ.get("MIMO_BASE_URL", "https://token-plan-sgp.xiaomimimo.com/v1")
MIMO_MODEL = os.environ.get("MIMO_MODEL", "mimo-v2.5")
# A full 5-day schedule is a large generation (~5-6k JSON tokens), and this only
# runs as a rare fallback (1 call when the deterministic parse fails), so a
# generous timeout beats a fast no-op. Not on the hot path.
MIMO_TIMEOUT_SEC = 90


def _mimo_json(system: str, user: str, max_tokens: int = 8192) -> dict | None:
    """One MiMo chat/completions call returning the parsed JSON object, or None.

    Single attempt, short timeout, graceful on every error (no key, network,
    non-200, bad JSON) — the caller always has a deterministic floor to fall back
    to, so this must never raise. Uses JSON-object mode (json_schema is not in
    MiMo's documented request schema) and disables thinking so temperature 0 is
    honored and no `reasoning_content` leaks into the response.
    """
    api_key = os.environ.get("MIMO_API_KEY")
    if not api_key:
        return None

    body = json.dumps(
        {
            "model": MIMO_MODEL,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": 0,
            "max_completion_tokens": max_tokens,
            "thinking": {"type": "disabled"},
            "response_format": {"type": "json_object"},
            "stream": False,
        }
    ).encode("utf-8")

    req = urllib.request.Request(
        f"{MIMO_BASE_URL.rstrip('/')}/chat/completions",
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=MIMO_TIMEOUT_SEC) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
        content = payload["choices"][0]["message"]["content"]
        # Defensive: strip a stray <think>…</think> block if thinking leaked into
        # content despite being disabled (some reasoning backends still inline it).
        if "<think>" in content:
            content = content.split("</think>")[-1]
        return json.loads(content)
    except Exception as e:
        # This is a graceful-None boundary: the caller always has a deterministic
        # floor, so a MiMo failure (network/SSL/HTTP/truncation/bad-JSON/shape)
        # must NEVER propagate and abort the crawl. Catch-all is intentional.
        logger.warning("MiMo call failed (%s): %s", type(e).__name__, str(e)[:200])
        return None


_SCHEDULE_SYSTEM = (
    "You convert a conference schedule (given as markdown/HTML text) into JSON. "
    "Respond ONLY with a JSON object of the exact shape: "
    '{"days":[{"day":"01","weekday":"","dateLabel":"","theme":"","venue":"",'
    '"venueImage":"","workshop_partners":[],'
    '"blocks":[{"time":"09:00","end":null,"host":null,"label":"","tone":"workshop",'
    '"luma":null,"lumaId":null}]}]}. '
    "Rules: copy times and titles VERBATIM from the source — never invent, "
    "translate, or normalize them. `day` is a zero-padded string ('01'..'05'). "
    "`tone` is one of break|workshop|signature (best guess from context). Use null "
    "for any field not present in the source. NEVER fabricate a `luma` URL — set it "
    "null unless an explicit luma.com link for that block appears in the source."
)


def _blocks_of(day: object) -> list:
    """Safely pull a day's blocks list (tolerates non-dict / missing / non-list)."""
    blocks = day.get("blocks") if isinstance(day, dict) else None
    return blocks if isinstance(blocks, list) else []


def parse_markdown_with_mimo(source_markdown: str, hint: str = "") -> list[dict] | None:
    """Parse unstructured schedule markdown into the day/block shape via MiMo.

    Returns the day list (same shape as schedule_parser.parse_js_array), or None
    when MiMo is unavailable / returns nothing usable, so the caller keeps its
    deterministic floor (markdown-regex / last-good baseline).

    A light verbatim gate rejects hallucinated registration links: every emitted
    `luma` URL must appear in the source. Times/titles are NOT verbatim-gated
    (times coincidentally substring-match; titles would fight the verbatim prompt
    and false-reject legit trims) — accepted risk for a rare, floored fallback.
    """
    if not os.environ.get("MIMO_API_KEY"):
        return None
    if not source_markdown or not source_markdown.strip():
        return None

    user = source_markdown if not hint else f"[{hint}]\n\n{source_markdown}"
    obj = _mimo_json(_SCHEDULE_SYSTEM, user)
    if not isinstance(obj, dict):
        return None

    days = obj.get("days")
    if not isinstance(days, list) or not days:
        logger.warning("MiMo schedule: no usable 'days' in response")
        return None

    # Verbatim gate: a hallucinated luma URL is the real risk here (it would send
    # users to a wrong/dead registration link). Reject the WHOLE parse if any
    # emitted luma isn't a substring of the source — a model that fabricated one
    # link has cast doubt on the rest, and the caller's baseline is real prior data.
    for day in days:
        for block in _blocks_of(day):
            luma = block.get("luma") if isinstance(block, dict) else None
            if luma and luma not in source_markdown:
                logger.warning("MiMo schedule: hallucinated luma %r not in source — rejecting", luma)
                return None

    # Normalize to the consumed shape (mirror schedule_parser): keep `day` string,
    # ensure block keys exist, retain anything extra.
    out: list[dict] = []
    for day in days:
        if not isinstance(day, dict) or "day" not in day:
            continue
        blocks: list[dict] = []
        for b in _blocks_of(day):
            if not isinstance(b, dict):
                continue
            block = dict(b)
            for key in ("time", "end", "host", "label", "tone", "luma", "lumaId"):
                block.setdefault(key, None)
            blocks.append(block)
        partners = day.get("workshop_partners")
        out.append(
            {
                "day": str(day.get("day")),
                "weekday": day.get("weekday"),
                "dateLabel": day.get("dateLabel"),
                "theme": day.get("theme"),
                "venue": day.get("venue"),
                "venueImage": day.get("venueImage"),
                "workshop_partners": [str(p) for p in partners] if isinstance(partners, list) else [],
                "blocks": blocks,
            }
        )
    if out:
        logger.info("MiMo schedule fallback: parsed %d days", len(out))
    return out or None
