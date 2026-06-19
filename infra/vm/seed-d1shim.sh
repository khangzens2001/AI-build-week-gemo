#!/usr/bin/env bash
# ONE-TIME (or manual reset) seed of the D1 shim's sqlite, run on the VM.
#
# WARNING: this WIPES user data (reminders/push/preferences) and reloads the
# static event rows. It runs scripts/db-reset-local.ts (which rmSync's the db
# file + -wal/-shm). NEVER call this from the deploy path. Run it once at
# provision time, BEFORE starting the d1shim container, then again only when you
# intentionally want to reset.
#
# It runs in a throwaway oven/bun container against the SAME named volume the
# d1shim uses (systemd-d1-data) and the SAME repo mount, so the seeded
# /data/app.sqlite is exactly what d1shim will serve.
#
# Usage (on the VM, as user zens):  infra/vm/seed-d1shim.sh
set -euo pipefail

REPO=/srv/event-copilot/repo
# The d1-data.volume Quadlet unit sets `VolumeName=d1-data`, so the real podman
# volume is exactly `d1-data` (NOT the `systemd-` prefixed default you'd get
# without VolumeName). Must match what d1shim.container mounts.
VOL=d1-data   # the podman volume backing d1-data.volume

if [[ ! -f "$REPO/scripts/db-reset-local.ts" ]]; then
  echo "ERROR: $REPO/scripts/db-reset-local.ts not found. Sync the repo to $REPO first." >&2
  exit 1
fi

echo "==> Stopping d1shim if running (avoid writing under a live WAL connection)"
systemctl --user stop d1shim.service 2>/dev/null || true

echo "==> Seeding /data/app.sqlite in a throwaway oven/bun container"
podman run --rm \
  -v "${VOL}:/data" \
  -v "${REPO}:/app:ro,Z" \
  -w /app \
  -e D1_LOCAL_DB=/data/app.sqlite \
  docker.io/oven/bun:debian \
  bun run scripts/db-reset-local.ts

echo "==> Done. Start the shim with:  systemctl --user start d1shim.service"
