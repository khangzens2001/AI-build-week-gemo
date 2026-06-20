#!/usr/bin/env bash
# Assemble the deployable Next.js standalone bundle for the VM (Podman) deploy.
#
# Next's `output: 'standalone'` traces most runtime deps, but it does NOT copy
# `public/` or `.next/static`, and it cannot follow `chromadb` (declared in
# serverExternalPackages + reached via a dynamic require + stored in bun's
# symlink store). This script produces a self-contained dir ready to rsync to
# the VM and run with `node apps/web/server.js`.
#
# Usage:  bun run build && scripts/package-standalone.sh [OUT_DIR]
#         OUT_DIR defaults to dist/standalone (gitignored).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

WEB=apps/web
STANDALONE="$WEB/.next/standalone"
OUT="${1:-dist/standalone}"

if [[ ! -f "$STANDALONE/apps/web/server.js" ]]; then
  echo "ERROR: $STANDALONE/apps/web/server.js not found. Run 'bun run build' first." >&2
  exit 1
fi

echo "==> Reset $OUT"
rm -rf "$OUT"
mkdir -p "$OUT"

echo "==> Copy standalone tree (preserve symlinks: bun's .bun store uses relative links)"
cp -R "$STANDALONE"/. "$OUT"/

echo "==> Copy static + public as siblings of the nested server"
mkdir -p "$OUT/apps/web/.next"
cp -R "$WEB/.next/static" "$OUT/apps/web/.next/static"
cp -R "$WEB/public" "$OUT/apps/web/public"

echo "==> Vendor chromadb (+ semver) into standalone node_modules (deref the pkg itself)"
# Resolve the real package dirs through bun's symlink store.
CHROMADB_SRC="$(cd "$WEB" 2>/dev/null && node -e "process.stdout.write(require('path').dirname(require.resolve('chromadb/package.json')))" 2>/dev/null || true)"
if [[ -z "${CHROMADB_SRC:-}" || ! -d "$CHROMADB_SRC" ]]; then
  # Fallback: glob bun's store.
  CHROMADB_SRC="$(ls -d node_modules/.bun/chromadb@*/node_modules/chromadb 2>/dev/null | head -1 || true)"
fi
SEMVER_SRC="$(ls -d node_modules/.bun/semver@*/node_modules/semver 2>/dev/null | head -1 || true)"

[[ -n "${CHROMADB_SRC:-}" && -d "$CHROMADB_SRC" ]] || { echo "ERROR: could not locate chromadb package source" >&2; exit 1; }
[[ -n "${SEMVER_SRC:-}"   && -d "$SEMVER_SRC"   ]] || { echo "ERROR: could not locate semver package source" >&2; exit 1; }

mkdir -p "$OUT/node_modules/chromadb" "$OUT/node_modules/semver"
cp -RL "$CHROMADB_SRC"/. "$OUT/node_modules/chromadb"/
cp -RL "$SEMVER_SRC"/.   "$OUT/node_modules/semver"/

echo "==> Link firebase-admin at the standalone node_modules root (server-side FCM)"
# firebase-admin is server-only; Next's tracer pulls its files into the bundle's
# bun store (node_modules/.bun/firebase-admin@*) but does NOT create the bare
# top-level `node_modules/firebase-admin` entry the generated server.js resolves.
# A relative symlink into the bun store fixes resolution AND keeps firebase-admin's
# full dep closure (google-auth-library, jws, …) intact (those are siblings inside
# the same store dir). rsync -a / cp -R preserve the relative link.
FB_STORE="$(ls -d "$OUT"/node_modules/.bun/firebase-admin@*/node_modules/firebase-admin 2>/dev/null | head -1 || true)"
[[ -n "${FB_STORE:-}" && -d "$FB_STORE" ]] || { echo "ERROR: firebase-admin not traced into the standalone bun store" >&2; exit 1; }
# Compute the path relative to $OUT/node_modules so the link is portable.
FB_REL="${FB_STORE#"$OUT"/node_modules/}"
ln -sfn "$FB_REL" "$OUT/node_modules/firebase-admin"

echo "==> Sanity: required-server-files + chromadb + firebase-admin present"
test -f "$OUT/apps/web/server.js"
test -d "$OUT/node_modules/chromadb"
test -e "$OUT/node_modules/firebase-admin/package.json"
test -d "$OUT/apps/web/.next/static"
test -d "$OUT/apps/web/public"

echo "==> Bundle size"
du -sh "$OUT"
echo "DONE: $OUT (run: PORT=3000 HOSTNAME=0.0.0.0 node apps/web/server.js)"
