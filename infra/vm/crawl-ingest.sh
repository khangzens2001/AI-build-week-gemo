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
# Runtime snapshot volume promoted to after a successful seed+embed; the web
# container hot-reloads packages/core/data/snapshot.json from here. Declared by
# infra/vm/quadlet/snapshot-data.volume (VolumeName=snapshot-data).
SNAPSHOT_VOL=snapshot-data
# Host dir that nginx serves /covers/ + /venues/ from (NOT a podman named volume —
# a volume's _data lives under ~/.local/share/containers, home-700, and host nginx
# (www-data) can't traverse it). A plain bind dir under /srv with world-readable
# files lets nginx serve crawl-refreshed covers without a web rebuild.
STATIC_DIR=/srv/event-copilot/static
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
  -e TZ="${EVENT_TZ:-Asia/Ho_Chi_Minh}" \
  -e FIRECRAWL_API_KEY \
  -e EXTERNAL_EVENT_RECHECK_HOURS="${EXTERNAL_EVENT_RECHECK_HOURS:-6}" \
  -e MIMO_API_KEY="${MIMO_API_KEY:-}" \
  -e MIMO_BASE_URL="${MIMO_BASE_URL:-}" \
  -e MIMO_MODEL="${MIMO_MODEL:-}" \
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
  -v "${SNAPSHOT_VOL}:/snap:z" \
  -e GOOGLE_GENERATIVE_AI_API_KEY \
  -e GEMINI_EMBED_MODEL="${GEMINI_EMBED_MODEL:-gemini-embedding-001}" \
  -e GEMINI_EMBED_DIM="${GEMINI_EMBED_DIM:-3072}" \
  -e CHROMA_HOST="${CHROMA_HOST:-chroma}" \
  -e CHROMA_PORT="${CHROMA_PORT:-8000}" \
  -e CHROMA_COLLECTION="${CHROMA_COLLECTION:-aabw}" \
  -e CRAWL_LATEST_DIR=/crawl/latest \
  -e SNAPSHOT_MIN_SESSIONS="${SNAPSHOT_MIN_SESSIONS:-14}" \
  docker.io/oven/bun:debian \
  sh -c 'set -e
    cp -a /src /work && cd /work && bun install && bun run seed && bun run embed
    # Promote the freshly-built snapshot for the web UI to hot-reload. Gate on a
    # session-count floor (reader in data.ts is authoritative at ~50% of the
    # baked-in count; this producer floor is the matching sanity gate) so a
    # partial crawl never publishes a near-empty schedule.
    SNAP=/work/packages/core/data/snapshot.json
    bun -e "
      const fs=require(\"node:fs\");
      const floor=Number(process.env.SNAPSHOT_MIN_SESSIONS||14);
      const d=JSON.parse(fs.readFileSync(\"$SNAP\",\"utf8\"));
      if(!Array.isArray(d.sessions)||d.sessions.length<floor){
        console.error(\"snapshot rejected: sessions=\"+(d.sessions?.length)+\" < floor=\"+floor);process.exit(3);
      }
      fs.copyFileSync(\"$SNAP\",\"/snap/.snapshot.json.tmp\");
      fs.renameSync(\"/snap/.snapshot.json.tmp\",\"/snap/snapshot.json\");
      console.log(\"snapshot promoted: \"+d.sessions.length+\" sessions, generatedAt \"+d.generatedAt);
    "
  '

echo "==> [2.5/3] Fetch session/venue images into the nginx-served static dir"
# fetch-images downloads Luma CDN covers + venue images. It is INTENTIONALLY
# non-fatal: it runs after seed+embed succeeded, so a transient Luma 404 must not
# abort the cycle (which would suppress the /api/ingest/hook signal below). The
# bun container reads the FRESH crawl JSON (FETCH_IMAGES_DATA_DIR=/crawl/latest)
# and writes covers into the static bind dir (FETCH_IMAGES_PUBLIC_DIR=/static).
# Stage 0 already baseline-seeds /static from the committed repo covers, so even a
# total fetch failure leaves the prior-good + committed covers in place.
# --userns=keep-id → files owned by the host `deploy`/`zens` user (predictable);
# fetch-images itself chmods dirs 755 / files 644 so nginx (www-data) can read.
mkdir -p "${STATIC_DIR}"
echo "    Baseline-seed static dir from committed repo covers/venues (no-clobber)"
cp -rn "${REPO}/apps/web/public/covers" "${STATIC_DIR}/" 2>/dev/null || true
cp -rn "${REPO}/apps/web/public/venues" "${STATIC_DIR}/" 2>/dev/null || true
chmod -R a+rX "${STATIC_DIR}" 2>/dev/null || true
podman run --rm \
  --userns=keep-id \
  -v "${REPO}:/src:ro,Z" \
  -v "${CRAWL_VOL}:/crawl:ro" \
  -v "${STATIC_DIR}:/static" \
  -e FETCH_IMAGES_DATA_DIR=/crawl/latest \
  -e FETCH_IMAGES_PUBLIC_DIR=/static \
  -e HOME=/tmp \
  -w /tmp \
  docker.io/oven/bun:debian \
  sh -c 'set -e; cp -a /src /tmp/work && cd /tmp/work && bun install && bun run fetch:images' \
  || echo "    fetch-images non-fatal failure — keeping baseline/committed covers." >&2
# Ensure anything fetch-images created is world-readable for nginx.
chmod -R a+rX "${STATIC_DIR}" 2>/dev/null || true

echo "==> [3/3] Signal /api/ingest/hook if content changed"
# Read the per-cycle change signal the crawler persisted into report.json. One
# throwaway container reads the volume AND builds the FULL hook payload (so event
# titles with commas/quotes/unicode are escaped by json.dumps, never by fragile
# shell quoting) — no host python3/jq dependency. It prints two lines:
#   line 1: changed_count   (gate)
#   line 2: compact JSON request body for /api/ingest/hook (concrete summary)
# The `after` text names the new/updated sessions so the Gemini summary (and its
# literal fallback) describe WHAT changed, not just "a page was updated".
HOOK_OUT=$(podman run --rm -v "${CRAWL_VOL}:/crawl:ro" \
  -e TZ="${EVENT_TZ:-Asia/Ho_Chi_Minh}" \
  docker.io/library/python:3.11-slim python -c \
  'import json, sys
try:
    d = json.load(open("/crawl/latest/report.json"))
except Exception:
    print(0); print(json.dumps({})); sys.exit(0)

count = int(d.get("changed_count", 0))
pages = d.get("changed_pages", []) or []
new_titles = d.get("new_event_titles", []) or []
chg_titles = d.get("changed_event_titles", []) or []

# Sessions are the only page-level change worth announcing to attendees. The
# other static pages are internal scaffolding whose slugs (home,
# builder_experience_track, leaderboard, partners) must NEVER leak into a
# user-facing announcement. We gate the Pulse on SESSION changes only; bare
# page-byte changes with no session delta are treated as noise and skipped.
def _join_titles(titles, cap=4):
    shown = titles[:cap]
    text = "; ".join(shown)
    extra = len(titles) - len(shown)
    if extra > 0:
        text += f", and {extra} more"
    return text

# Effective gate: only announce when actual sessions were added or changed.
session_count = len(new_titles) + len(chg_titles)

# When the crawler detected the change. Prefer the event_report timestamp, fall
# back to the top-level report generated_at. These are NAIVE ISO strings (no
# offset). We resolve them to an unambiguous epoch-ms here, interpreting the
# naive value in THIS container local timezone — which the podman run sets to
# Asia/Ho_Chi_Minh (TZ env below), matching the crawl container that wrote it.
# Sent to the hook as detectedAt (epoch ms) so the Pulse "time ago" reflects
# detection time, not embed+POST completion, with zero TZ ambiguity downstream.
er = d.get("event_report", {}) or {}
detected_iso = er.get("generated_at") or d.get("generated_at")
detected_ms = None
if detected_iso:
    try:
        import datetime as _dt
        detected_ms = int(_dt.datetime.fromisoformat(detected_iso).timestamp() * 1000)
    except Exception:
        detected_ms = None

parts = []
if new_titles:
    parts.append("New sessions: " + _join_titles(new_titles) + ".")
if chg_titles:
    parts.append("Updated sessions: " + _join_titles(chg_titles) + ".")
after = " ".join(parts)

# Title mirrors exactly what happened (added vs updated), session-centric.
if new_titles and chg_titles:
    title = f"{len(new_titles)} new + {len(chg_titles)} updated sessions"
elif new_titles:
    title = "New session added" if len(new_titles) == 1 else f"{len(new_titles)} new sessions added"
elif chg_titles:
    title = "Session updated" if len(chg_titles) == 1 else f"{len(chg_titles)} sessions updated"
else:
    title = ""

body = {
    "url": "https://agenticaibuildweek.genaifund.ai/#daily_schedule",
    "changeType": "recrawl",
    "title": title,
    "after": after,
    "kind": "schedule",
    "severity": "info",
}
# detectedAt is epoch ms resolved from the crawler naive generated_at in the
# event timezone (this container runs TZ=Asia/Ho_Chi_Minh, see podman run). The
# hook stores it verbatim as created_at, so the "time ago" is correct regardless
# of the consumer clock.
if detected_ms:
    body["detectedAt"] = detected_ms
# Gate on session_count, NOT the broader changed_count: a cycle where only the
# static marketing pages shifted bytes (but no session changed) prints 0 here,
# so the shell skips the hook and Pulse stays quiet instead of posting a vague
# "pages were revised" item with no attendee value.
print(session_count)
print(json.dumps(body))' 2>/dev/null || printf '0\n{}\n')

CHANGED_COUNT=$(printf '%s\n' "$HOOK_OUT" | sed -n '1p')
HOOK_BODY=$(printf '%s\n' "$HOOK_OUT" | sed -n '2p')

if [[ "${CHANGED_COUNT:-0}" -gt 0 ]]; then
  if [[ -z "${INGEST_HOOK_TOKEN:-}" ]]; then
    echo "    changed_count=$CHANGED_COUNT but INGEST_HOOK_TOKEN unset — skipping Pulse signal." >&2
  else
    echo "    $CHANGED_COUNT session change(s) detected — POSTing re-ingest hook."
    # The hook summarizes the change (Gemini) into a Cue Pulse announcement + push.
    curl -fsS -m 30 \
      -H "Authorization: Bearer ${INGEST_HOOK_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "${HOOK_BODY}" \
      "${WEB_URL}/api/ingest/hook" >/dev/null
    echo "    Pulse signal sent."
  fi
else
  echo "    No session changes this cycle — nothing to signal."
fi

echo "==> Done."
