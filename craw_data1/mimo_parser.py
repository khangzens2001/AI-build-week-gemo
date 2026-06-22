"""
MiMo (Xiaomi) LLM fallback parser for the AABW schedule.

This is the FALLBACK path: it only runs when the deterministic JS-bundle parse
(schedule_parser.py) is unavailable — i.e. the React-SPA bundle couldn't be
fetched/extracted or its literal no longer parses. In that case the only source
left is the homepage's unstructured markdown/HTML, where an LLM genuinely beats a
brittle regex (the current `parse_daily_schedule_events` only handles Day-1).

Status: the live MiMo call is DEFERRED (returns None) so the deterministic fix
ships first. Wiring is complete so enabling it later is a body-swap, not a
control-flow change. When implemented, this will POST to MiMo's OpenAI-compatible
endpoint via stdlib urllib (no SDK dep), with:
  - model        = $MIMO_MODEL (default mimo-v2.5)
  - temperature  = 0
  - thinking     = disabled  (so temp 0 actually applies; no reasoning_content)
  - response_format = { type: "json_object" }   (json_schema is unsupported)
  - one attempt, ~20s timeout (no retry storm; 1 call/cycle)
and a light gate: shape valid + any luma-looking URL must be a substring of the
source markdown (no hallucinated registration links).

Config (env): MIMO_API_KEY, MIMO_BASE_URL (default token-plan-sgp .../v1),
MIMO_MODEL (default mimo-v2.5).
"""
from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)

MIMO_BASE_URL = os.environ.get("MIMO_BASE_URL", "https://token-plan-sgp.xiaomimimo.com/v1")
MIMO_MODEL = os.environ.get("MIMO_MODEL", "mimo-v2.5")


def parse_markdown_with_mimo(source_markdown: str, hint: str = "") -> list[dict] | None:
    """Parse unstructured schedule markdown into the day/block shape via MiMo.

    DEFERRED: returns None until the live MiMo call is implemented. Returning None
    makes the caller keep the existing markdown-regex floor / last-good baseline,
    so this stub never degrades current behavior.
    """
    if not os.environ.get("MIMO_API_KEY"):
        # No key configured → nothing to do; deterministic path / baseline owns it.
        return None
    # TODO(P2): implement the urllib POST + json_object parse + verbatim-URL gate.
    logger.info("parse_markdown_with_mimo: MiMo fallback not yet enabled (stub) — hint=%r", hint)
    return None
