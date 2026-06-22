"""
Deterministic schedule parser for the AABW React-SPA JS bundle.

The site embeds the full 5-day schedule as a JavaScript object-literal ARRAY
inside its minified bundle. The old approach hand-wrote a positional regex over
that literal (scraper.py), which silently broke the moment the site inserted a
new field (`mapUrl`) between `venue` and `venueImage` — the regex matched 0 days
and the pipeline fell back to a weak Day-1-only markdown parse, leaving stale /
partner-name-as-title data in the UI.

This module replaces that regex with a deterministic JSON5 parse: the literal is
*almost* JSON5 already, so we only sanitize the handful of non-JSON tokens the
minifier emits, then parse it structurally. This is immune to field reorder /
insertion (the exact drift that broke us) and never hallucinates — unlike an LLM,
which is reserved for the genuinely-unstructured markdown fallback (mimo_parser).

Output shape matches exactly what event_pipeline.parse_bundle_schedule_events and
the TS seed transform already consume:

    [{ day, weekday, dateLabel, theme, venue, venueImage, workshop_partners[],
       blocks: [{ time, end, host, label, tone, luma, lumaId, ... }] }, ...]

`day` is preserved as the zero-padded string ("01".."05") to keep the downstream
contract byte-identical.
"""
from __future__ import annotations

import logging
import re

import json5

logger = logging.getLogger(__name__)


def sanitize_js_array(raw: str) -> str:
    """Turn the minified JS object-literal array into valid JSON5.

    Only three token classes in the literal aren't JSON5-parseable, and the order
    of these substitutions matters:

      1. Backtick template literals (``description:`...```) — strip FIRST, so a
         description body that happens to contain `src:` etc. can't be touched by
         the bare-ref step below.
      2. JS shorthand booleans `!0`/`!1` → null (we don't read them).
      3. Bare identifier references — in the live shape the ONLY bare ref is
         `src:Cy` / `src:Ay.url` inside `workshops[]` (image module refs). Every
         other value is a quoted string, number, array, or object. We null just
         `src:` rather than a blanket `:ref` rule, so we can never corrupt a
         quoted value. If the site ever introduces a NEW bare-ref key, json5 will
         raise and the caller degrades observably (status != "js") instead of
         silently parsing wrong data.
    """
    s = re.sub(r":`[^`]*`", ':""', raw)          # 1: backtick templates -> ""
    s = re.sub(r":!\d", ":null", s)               # 2: !0/!1 -> null
    s = re.sub(r"\bsrc:[A-Za-z_$][\w$]*(?:\.[\w$]+)*", "src:null", s)  # 3: src refs
    return s


def _to_blocks(raw_blocks: object) -> list[dict]:
    """Normalize each block to the consumed shape, keeping extra fields.

    Extra keys (speaker/linkedin) are retained as-is — downstream reads via .get()
    so they're harmless, and they're useful future enrichment data. NOTE: `description`
    is preserved as a KEY but its value is emptied: it's a backtick template literal
    that sanitize_js_array replaces with "" (we don't parse JS template bodies). If a
    description body is ever needed, convert the backtick literal to a proper JSON
    string in sanitize instead of nulling it.
    """
    blocks: list[dict] = []
    if not isinstance(raw_blocks, list):
        return blocks
    for b in raw_blocks:
        if not isinstance(b, dict):
            continue
        block = dict(b)  # retain everything the literal had
        block.setdefault("time", None)
        block.setdefault("end", None)
        block.setdefault("host", None)
        block.setdefault("label", None)
        block.setdefault("tone", None)
        block.setdefault("luma", None)
        block.setdefault("lumaId", None)
        blocks.append(block)
    return blocks


def _workshop_partners(day: dict) -> list[str]:
    """Map the literal's `workshops:[{name,...}]` → the consumed `workshop_partners`.

    Falls back to an existing `workshop_partners` list if the shape ever changes.
    """
    workshops = day.get("workshops")
    if isinstance(workshops, list):
        names = [
            str(w["name"])
            for w in workshops
            if isinstance(w, dict) and w.get("name")
        ]
        if names:
            return names
    existing = day.get("workshop_partners")
    return [str(x) for x in existing] if isinstance(existing, list) else []


def parse_js_array(raw: str) -> list[dict] | None:
    """Parse the bracket-matched JS schedule array into the consumed day shape.

    Returns the day list, or None if the literal can't be parsed (caller then
    tries the MiMo markdown fallback, else keeps the last-good baseline).
    """
    try:
        parsed = json5.loads(sanitize_js_array(raw))
    except Exception as e:  # json5 raises on unexpected tokens (e.g. a NEW bare ref)
        logger.warning("parse_js_array: json5 parse failed: %s", str(e)[:200])
        return None

    if not isinstance(parsed, list) or not parsed:
        logger.warning("parse_js_array: parsed value is not a non-empty array")
        return None

    days: list[dict] = []
    for d in parsed:
        if not isinstance(d, dict) or "day" not in d:
            continue
        days.append(
            {
                # Keep `day` as the source string ("01".."05") — downstream contract.
                "day": str(d.get("day")),
                "weekday": d.get("weekday"),
                "dateLabel": d.get("dateLabel"),
                "theme": d.get("theme"),
                "venue": d.get("venue"),
                "venueImage": d.get("venueImage"),
                "workshop_partners": _workshop_partners(d),
                "blocks": _to_blocks(d.get("blocks")),
            }
        )
    return days or None


def verify_against_raw(days: list[dict], raw: str) -> bool:
    """Self-check the parsed days against the raw literal.

    Guards the (narrow) sanitize step: every retained STRING value — top-level day
    fields and every block field — must appear verbatim in the raw array. If
    sanitize ever corrupted a value inside a string, the corrupted value won't be a
    substring of `raw` and this fails, so the caller treats the parse as
    untrustworthy (degrade, don't ship bad data).

    Note: json5 decodes escapes (\\", \\uXXXX). The current bundle stores literal
    UTF-8 so decoded values match raw; if a future title carries an escaped char
    this could false-negative → safe-fail to baseline (never ships wrong data).
    `workshop_partners` is excluded: it's DERIVED (workshops[].name), not a verbatim
    slice, so a substring check doesn't apply.
    """
    for day in days:
        for key, val in day.items():
            if key in ("blocks", "workshop_partners"):
                continue
            if isinstance(val, str) and val and val not in raw:
                logger.warning("verify_against_raw: day.%s=%r not in source", key, val)
                return False
        for block in day.get("blocks", []):
            for key, val in block.items():
                if isinstance(val, str) and val and val not in raw:
                    logger.warning("verify_against_raw: block.%s=%r not in source", key, val)
                    return False
    return True
