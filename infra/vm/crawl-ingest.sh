#!/usr/bin/env bash
# Auto-crawl → re-ingest one-shot (run on the VM by crawl-ingest.timer, or by hand).
#
# Runs the full pipeline in throwaway Podman containers, sharing one writable
# `crawl-data` volume, then signals the app so a content change goes live:
#
#   1. CRAWL  — python:3.11-slim runs craw_data1/main.py --once. Repo is mounted
#               read-only; the crawl-data volume is mounted at craw_data1/data so
#               the scraper's writes (latest/, history/, report.json) persist.
#   2. SEED+EMBED — oven/bun copies the repo to a writable /work (the repo mount is
#               :ro, and seed writes snapshot/chunks/seed.sql under it — so we run
#               in a copy, exactly like seed-chroma.sh). Reads the fresh crawl JSON
#               from the volume via CRAWL_LATEST_DIR, then embeds chunks → Chroma.
#   3. SIGNAL — if the crawl reported changed pages (report.json .changed_count>0),
#               POST /api/ingest/hook (Bearer INGEST_HOOK_TOKEN) AFTER embedding, so
#               the Cue Pulse + push only fire once RAG is actually up to date.
#
# WARNING: the SEED step emits drizzle/seed.sql, but we DELIBERATELY never apply it
# and never run scripts/db-reset-local.ts here — that wipes the d1shim sqlite
# (reminders/push/prefs). This loop only updates Chroma (RAG) + Cue Pulse, never D1.
#
# App-UI note: packages/core/data/snapshot.json is imported at BUILD time, so new
# sessions/venues reach the UI only after a rebuild+redeploy. This loop keeps the
# RAG/chat answers + live Pulse current between deploys.
#
# Prereqs on the VM (as user zens):
#   - /srv/event-copilot/repo synced (craw_data1/, packages/, scripts/, drizzle/).
#   - chroma container running (systemctl --user start chroma.service).
#   - /srv/event-copilot/shared/web.env has FIRECRAWL_API_KEY, INGEST_HOOK_TOKEN,
#     GOOGLE_GENERATIVE_AI_API_KEY, GEMINI_EMBED_*, CHROMA_*.
#
# Usage (on the VM):  infra/vm/crawl-ingest.sh
set -euo pipefail

REPO=/srv/event-copilot/repo
ENVFILE=/srv/event-copilot/shared/web.env
# Dedicated podman volume for crawl output (writable; survives between cycles so
# change-detection has a prior snapshot to diff against).
CRAWL_VOL=crawl-data
# Dedicated podman volume the web container hot-reloads the runtime snapshot from
# (infra/vm/quadlet/snapshot-data.volume). We write the freshly-seeded snapshot
# here atomically so the Schedule/now/next UI updates without a rebuild+redeploy.
SNAPSHOT_VOL=snapshot-data
# Web container's loopback-published port (same one reminders.service curls).
WEB_URL=http://127.0.0.1:3000

if [[ ! -f "$REPO/craw_data1/main.py" ]]; then
  echo "ERROR: $REPO/craw_data1/main.py not found. Sync the repo to $REPO first." >&2
  exit 1
fi

# Pull secrets/config from web.env (FIRECRAWL_API_KEY, INGEST_HOOK_TOKEN, GEMINI_*,
# CHROMA_*, GOOGLE_GENERATIVE_AI_API_KEY) into this shell's environment.
if [[ -f "$ENVFILE" ]]; then
  # shellcheck disable=SC1090
  set -a; . "$ENVFILE"; set +a
fi
: "${FIRECRAWL_API_KEY:?set FIRECRAWL_API_KEY in $ENVFILE}"
: "${GOOGLE_GENERATIVE_AI_API_KEY:?set GOOGLE_GENERATIVE_AI_API_KEY in $ENVFILE}"

# The crawl-data volume is owned/created by the Quadlet unit
# (infra/vm/quadlet/crawl-data.volume → crawl-data-volume.service), which the
# crawl-ingest.service Wants/After. We don't create it here so there's a single
# declarative owner (and the volume keeps its app=event-copilot label). If you
# run this script by hand outside systemd, materialize it first with:
#   systemctl --user start crawl-data-volume.service
# Stage 0 below still primes an empty volume from the committed baseline.

echo "==> [0/3] Prime crawl volume with last-known-good baseline (no-clobber)"
# The crawler only writes pages it successfully (re)scrapes; some inputs the seed
# step needs (e.g. bundle_schedule.json, parsed from a minified JS bundle whose
# shape drifts) may be absent on a given run. Per packages/ingest/AGENTS.md the
# pipeline must keep a mock-data fallback so a brittle/partial crawl degrades to
# the prior good data instead of crashing seed. We copy the committed baseline
# (repo/craw_data1/data) into the volume with `cp -n` (no-clobber): existing
# volume files from this or prior cycles always win; only missing files are
# backfilled. On the very first run this fully primes an empty volume.
podman run --rm \
  -v "${REPO}/craw_data1/data:/baseline:ro,Z" \
  -v "${CRAWL_VOL}:/data" \
  docker.io/library/python:3.11-slim \
  sh -c 'set -e; cp -rn /baseline/. /data/ 2>/dev/null || true; ls /data/latest >/dev/null'

echo "==> [1/3] Crawl (craw_data1/main.py --once)"
# Repo mounted :ro; crawl-data volume mounted at craw_data1/data so the scraper's
# writes persist (config.py makes data/{latest,history} at import time). config.py
# ALSO creates data/../logs at import, so give it a writable tmpfs for logs (they're
# ephemeral — only the JSON under data/ needs to survive the cycle).
podman run --rm \
  -v "${REPO}/craw_data1:/app:ro,Z" \
  -v "${CRAWL_VOL}:/app/data" \
  --tmpfs /app/logs \
  -w /app \
  -e FIRECRAWL_API_KEY \
  -e EXTERNAL_EVENT_RECHECK_HOURS="${EXTERNAL_EVENT_RECHECK_HOURS:-6}" \
  docker.io/library/python:3.11-slim \
  sh -c 'set -e; pip install --quiet --no-cache-dir -r requirements.txt && python main.py --once'

echo "==> [2/3] Seed + embed (bun, writable copy; reads crawl volume; → Chroma)"
# Run in a copied /work because seed writes snapshot/chunks/seed.sql under the
# (otherwise :ro) repo tree. Crawl volume mounted :ro at /crawl; CRAWL_LATEST_DIR
# points seed at the fresh JSON. Attached to ecnet so embed reaches chroma by name.
# The snapshot-data volume is mounted rw at /snap: after a successful seed+embed,
# we ATOMICALLY promote the freshly-built snapshot.json there (temp + rename on the
# same fs) — but ONLY if it's valid JSON with a sane session count, so a brittle
# crawl can't wipe the live Schedule UI. The web container hot-reloads /snap.
podman run --rm \
  --network ecnet \
  -v "${REPO}:/src:ro,Z" \
  -v "${CRAWL_VOL}:/crawl:ro" \
  -v "${SNAPSHOT_VOL}:/snap" \
  -e GOOGLE_GENERATIVE_AI_API_KEY \
  -e GEMINI_EMBED_MODEL="${GEMINI_EMBED_MODEL:-gemini-embedding-001}" \
  -e GEMINI_EMBED_DIM="${GEMINI_EMBED_DIM:-3072}" \
  -e CHROMA_HOST="${CHROMA_HOST:-chroma}" \
  -e CHROMA_PORT="${CHROMA_PORT:-8000}" \
  -e CHROMA_COLLECTION="${CHROMA_COLLECTION:-aabw}" \
  -e CRAWL_LATEST_DIR=/crawl/latest \
  -e SNAPSHOT_MIN_SESSIONS="${SNAPSHOT_MIN_SESSIONS:-10}" \
  docker.io/oven/bun:debian \
  sh -c 'set -e
    cp -a /src /work && cd /work && bun install && bun run seed && bun run embed
    # Promote the freshly-built snapshot for the web UI to hot-reload. Gate on a
    # session-count floor so a partial crawl never publishes a near-empty schedule.
    SNAP=/work/packages/core/data/snapshot.json
    bun -e "
      const fs=require(\"node:fs\");
      const floor=Number(process.env.SNAPSHOT_MIN_SESSIONS||10);
      const d=JSON.parse(fs.readFileSync(\"$SNAP\",\"utf8\"));
      if(!Array.isArray(d.sessions)||d.sessions.length<floor){
        console.error(\"snapshot rejected: sessions=\"+(d.sessions?.length)+\" < floor=\"+floor);process.exit(3);
      }
      fs.copyFileSync(\"$SNAP\",\"/snap/.snapshot.json.tmp\");
      fs.renameSync(\"/snap/.snapshot.json.tmp\",\"/snap/snapshot.json\");
      console.log(\"snapshot promoted: \"+d.sessions.length+\" sessions, generatedAt \"+d.generatedAt);
    "
  '

echo "==> [3/3] Signal /api/ingest/hook if content changed"
# Read the per-cycle change signal the crawler persisted into report.json. One
# throwaway container reads the volume AND parses both fields (count drives the
# gate; pages drive the payload text) — no host `python3`/`jq` dependency, matching
# the throwaway-container pattern used everywhere else in this stack.
read -r CHANGED_COUNT CHANGED_PAGES < <(podman run --rm -v "${CRAWL_VOL}:/crawl:ro" \
  docker.io/library/python:3.11-slim python -c \
  'import json
try:
    d = json.load(open("/crawl/latest/report.json"))
    print(int(d.get("changed_count", 0)), ",".join(d.get("changed_pages", [])))
except Exception:
    print("0 ")' 2>/dev/null || echo "0 ")

if [[ "${CHANGED_COUNT:-0}" -gt 0 ]]; then
  if [[ -z "${INGEST_HOOK_TOKEN:-}" ]]; then
    echo "    changed_count=$CHANGED_COUNT but INGEST_HOOK_TOKEN unset — skipping Pulse signal." >&2
  else
    echo "    $CHANGED_COUNT page(s) changed (${CHANGED_PAGES:-?}) — POSTing re-ingest hook."
    # The hook summarizes the change (Gemini) into a Cue Pulse announcement + push.
    curl -fsS -m 30 \
      -H "Authorization: Bearer ${INGEST_HOOK_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "{\"url\":\"https://agenticaibuildweek.genaifund.ai/\",\"changeType\":\"recrawl\",\"title\":\"Event info updated\",\"after\":\"Updated pages: ${CHANGED_PAGES}\"}" \
      "${WEB_URL}/api/ingest/hook" >/dev/null
    echo "    Pulse signal sent."
  fi
else
  echo "    No content changes this cycle — nothing to signal."
fi

echo "==> Done."
