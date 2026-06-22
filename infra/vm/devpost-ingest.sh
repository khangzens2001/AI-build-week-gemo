#!/usr/bin/env bash
# Devpost scrape → embed one-shot (run on the VM by devpost-ingest.timer, or by hand).
#
# Scrapes the Agentic AI Build Week Devpost pages (rules / resources / updates /
# project-gallery / home) via Firecrawl and embeds the resulting retrieval chunks
# into the SAME Chroma collection the event crawl-ingest sweep feeds. This is the
# Devpost analogue of crawl-ingest.sh, but RAG-ONLY:
#
#   1. SCRAPE — oven/bun copies the repo to a writable /work (the repo mount is
#               :ro, and the scraper writes per-page JSON + retrieval_chunks.json
#               + report.json under packages/ingest/data/devpost). We point
#               DEVPOST_OUTPUT_DIR at a `devpost-data` volume mounted into the
#               copy so the scrape output persists between cycles, exactly like
#               crawl-ingest.sh persists craw_data1/data on the crawl-data volume.
#   2. EMBED  — oven/bun (attached to ecnet so it reaches the `chroma` container by
#               name) runs `bun run embed`. embed.ts reads the Devpost
#               retrieval_chunks.json (via DEVPOST_CHUNKS_FILE) AND the event
#               packages/core/data/chunks.json if present, dedupes by id, and
#               upserts everything into Chroma. Devpost chunk ids are prefixed
#               `devpost-...` so they never collide with event ids.
#
# WARNING: this loop NEVER touches D1 / drizzle seed.sql / the snapshot / the web
# UI signal. Devpost content is reference material for chat RAG only; there is no
# Cue Pulse push and no schedule mutation. (Contrast crawl-ingest.sh, which also
# promotes a snapshot + signals /api/ingest/hook.)
#
# Cadence: enabled by event-copilot-devpost-ingest.timer on a SLOWER 6h cadence
# than the 30-min event crawl, because Devpost rules/resources/gallery change far
# less often and each cycle re-embeds the Devpost chunks (Gemini cost).
#
# Prereqs on the VM (as user zens):
#   - /srv/event-copilot/repo synced (packages/).
#   - chroma container running (systemctl --user start chroma.service).
#   - /srv/event-copilot/shared/web.env has FIRECRAWL_API_KEY,
#     GOOGLE_GENERATIVE_AI_API_KEY, GEMINI_EMBED_*, CHROMA_*.
#   - the devpost-data volume materialized (Quadlet: devpost-data-volume.service,
#     which the .service Wants/After — or `podman volume create devpost-data`).
#
# ONE-TIME operator step (the deploy ships the unit files but does NOT enable a
# new timer): on the VM run
#   systemctl --user enable --now event-copilot-devpost-ingest.timer
#
# Usage (on the VM):  infra/vm/devpost-ingest.sh
set -euo pipefail

REPO=/srv/event-copilot/repo
ENVFILE=/srv/event-copilot/shared/web.env
# Dedicated podman volume for Devpost scrape output (writable; survives between
# cycles). Mounted into the writable /work copy at the scraper's output dir, and
# again (read-only) into the embed container so embed.ts can read its chunks.
DEVPOST_VOL=devpost-data
# Path INSIDE the bun containers where DEVPOST_VOL is mounted. The scraper writes
# here (DEVPOST_OUTPUT_DIR) and the embed step reads retrieval_chunks.json from
# here (DEVPOST_CHUNKS_FILE).
DEVPOST_MOUNT=/devpost

if [[ ! -f "$REPO/packages/ingest/src/devpost/run.ts" ]]; then
  echo "ERROR: $REPO/packages/ingest/src/devpost/run.ts not found. Sync the repo to $REPO first." >&2
  exit 1
fi

# Pull secrets/config from web.env (FIRECRAWL_API_KEY, GEMINI_*, CHROMA_*,
# GOOGLE_GENERATIVE_AI_API_KEY) into this shell's environment.
if [[ -f "$ENVFILE" ]]; then
  # shellcheck disable=SC1090
  set -a; . "$ENVFILE"; set +a
fi
: "${FIRECRAWL_API_KEY:?set FIRECRAWL_API_KEY in $ENVFILE}"
: "${GOOGLE_GENERATIVE_AI_API_KEY:?set GOOGLE_GENERATIVE_AI_API_KEY in $ENVFILE}"

# The devpost-data volume is owned/created by the Quadlet unit
# (infra/vm/quadlet/devpost-data.volume → devpost-data-volume.service), which the
# devpost-ingest.service Wants/After. We don't create it here so there's a single
# declarative owner (and the volume keeps its app=event-copilot label). If you
# run this script by hand outside systemd, materialize it first with:
#   systemctl --user start devpost-data-volume.service

echo "==> [1/2] Scrape Devpost pages (bun, writable copy; → devpost-data volume)"
# Run in a copied /work because the repo mount is :ro and the scraper writes its
# output tree under packages/ingest/data. DEVPOST_OUTPUT_DIR redirects that write
# at the mounted volume so the JSON + retrieval_chunks.json persist.
podman run --rm \
  -v "${REPO}:/src:ro,Z" \
  -v "${DEVPOST_VOL}:${DEVPOST_MOUNT}" \
  -e FIRECRAWL_API_KEY \
  -e DEVPOST_OUTPUT_DIR="${DEVPOST_MOUNT}" \
  docker.io/oven/bun:debian \
  sh -c 'set -e; cp -a /src /work && cd /work && bun install && bun run ingest:devpost'

echo "==> [2/2] Embed Devpost chunks into Chroma (bun, ecnet, host=chroma)"
# Attached to ecnet so embed reaches chroma by name. The devpost-data volume is
# mounted :ro and DEVPOST_CHUNKS_FILE points embed.ts at the fresh chunks. embed.ts
# merges these with the event chunks.json (if present in the repo copy) and upserts
# all into Chroma; a missing event file is skipped, so this works Devpost-only.
podman run --rm \
  --network ecnet \
  -v "${REPO}:/src:ro,Z" \
  -v "${DEVPOST_VOL}:${DEVPOST_MOUNT}:ro" \
  -e GOOGLE_GENERATIVE_AI_API_KEY \
  -e GEMINI_EMBED_MODEL="${GEMINI_EMBED_MODEL:-gemini-embedding-001}" \
  -e GEMINI_EMBED_DIM="${GEMINI_EMBED_DIM:-3072}" \
  -e CHROMA_HOST="${CHROMA_HOST:-chroma}" \
  -e CHROMA_PORT="${CHROMA_PORT:-8000}" \
  -e CHROMA_COLLECTION="${CHROMA_COLLECTION:-aabw}" \
  -e DEVPOST_CHUNKS_FILE="${DEVPOST_MOUNT}/retrieval_chunks.json" \
  docker.io/oven/bun:debian \
  sh -c 'set -e; cp -a /src /work && cd /work && bun install && bun run embed'

echo "==> Done. Devpost chunks scraped + embedded into Chroma."
