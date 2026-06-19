#!/usr/bin/env bash
# ONE-TIME (or refresh) embed of the retrieval chunks into the Chroma container.
# Runs `bun run embed` in a throwaway oven/bun container ATTACHED to ecnet so it
# reaches the chroma container by name. Idempotent: embed.ts upserts (no recreate),
# so re-running is safe as long as GEMINI_EMBED_DIM is unchanged.
#
# Prereqs on the VM:
#   - chroma container running (systemctl --user start chroma.service)
#   - /srv/event-copilot/repo synced (contains packages/core/data/chunks.json + scripts)
#   - GOOGLE_GENERATIVE_AI_API_KEY exported (or present in web.env)
#
# Usage (on the VM, as zens):
#   GOOGLE_GENERATIVE_AI_API_KEY=... infra/vm/seed-chroma.sh
#   # or rely on web.env:
#   infra/vm/seed-chroma.sh
set -euo pipefail

REPO=/srv/event-copilot/repo
ENVFILE=/srv/event-copilot/shared/web.env

if [[ ! -f "$REPO/packages/core/data/chunks.json" ]]; then
  echo "ERROR: $REPO/packages/core/data/chunks.json not found. Sync the repo first." >&2
  exit 1
fi

# Pull the Gemini key + embed dim from web.env if not already in the environment.
if [[ -z "${GOOGLE_GENERATIVE_AI_API_KEY:-}" && -f "$ENVFILE" ]]; then
  # shellcheck disable=SC1090
  set -a; . "$ENVFILE"; set +a
fi
: "${GOOGLE_GENERATIVE_AI_API_KEY:?set GOOGLE_GENERATIVE_AI_API_KEY or fill it in $ENVFILE}"

echo "==> Embedding chunks into Chroma (via ecnet, host=chroma)"
# Repo is mounted read-only; copy to a writable dir inside the container, install
# deps there, then run embed. (One-time op — throwaway container.)
podman run --rm \
  --network ecnet \
  -v "${REPO}:/src:ro,Z" \
  -e GOOGLE_GENERATIVE_AI_API_KEY \
  -e GEMINI_EMBED_MODEL="${GEMINI_EMBED_MODEL:-gemini-embedding-001}" \
  -e GEMINI_EMBED_DIM="${GEMINI_EMBED_DIM:-3072}" \
  -e CHROMA_HOST=chroma \
  -e CHROMA_PORT=8000 \
  -e CHROMA_COLLECTION="${CHROMA_COLLECTION:-aabw}" \
  docker.io/oven/bun:debian \
  sh -c 'set -e; cp -a /src /work && cd /work && bun install && bun run embed'

echo "==> Done embedding."
