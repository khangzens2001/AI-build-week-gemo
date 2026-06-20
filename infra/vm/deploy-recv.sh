#!/usr/bin/env bash
# Forced command for the CI deploy key (referenced from ~zens/.ssh/authorized_keys
# as: command="/srv/event-copilot/deploy-recv.sh",restrict ssh-ed25519 ...).
#
# IMPORTANT: this file is the SOURCE; the ACTIVE forced command is the copy at
# /srv/event-copilot/deploy-recv.sh. Editing this does NOT update the VM — you
# must re-install it manually (cp + chmod +x) for changes to take effect.
#
# THREAT MODEL: the private key lives in a third-party-owned GitHub repo's
# secrets. A leaked key must NOT be able to (a) get a shell, (b) read files off
# the VM (e.g. the live secrets in ../shared/web.env), or (c) write anywhere
# except the two allowed bundle/source dirs (app, repo).
#
# We delegate the rsync surface to **rrsync** (ships with rsync) rather than
# hand-rolling it. rrsync confines every transfer to a root dir, munges incoming
# symlinks (so a planted symlink can't redirect writes), and filters the
# dangerous receiver options (--temp-dir/-T, --partial-dir, --backup-dir,
# --keep-dirlinks/-K, …) that would otherwise let a crafted `rsync --server`
# write OUTSIDE the dest path. A plain last-token path check does NOT stop those.
#
# We confine rrsync to /srv/event-copilot but additionally gate the requested
# sub-path to `app` or `repo` ONLY — so the key can't write into the sibling
# `shared/` (where web.env lives), even though it's under the rrsync root.
#
# Allowed, and nothing else:
#   1) rrsync write-only (-wo) transfers whose path resolves under
#      /srv/event-copilot/{app,repo}.  (app = built Next.js bundle; repo = source
#      the crawl-ingest pipeline + d1shim/seed scripts run from.)
#   2) `touch /srv/event-copilot/app/.deployed` (fires the web-reload .path unit).
#
# CI sends rsync dest paths RELATIVE to the rrsync root, i.e. `app/` and `repo/…`.
set -euo pipefail
cmd="${SSH_ORIGINAL_COMMAND:-}"

deny() { echo "deploy-recv: denied: $1" >&2; exit 1; }

case "$cmd" in
  "touch /srv/event-copilot/app/.deployed")
    exec touch /srv/event-copilot/app/.deployed
    ;;
  "rsync --server "*)
    # Reject the sender (read) half outright — defense in depth; rrsync -wo also
    # refuses it. The sender half always carries a standalone ` --sender ` flag.
    case " $cmd " in
      *" --sender "*) deny "rsync --sender (read) not allowed" ;;
    esac
    # Gate the requested sub-path to app/ or repo/ before handing off, so a leaked
    # key can't target the sibling shared/ dir. rrsync's path is the final token,
    # sent relative to the confined root (e.g. `app/`, `repo/`, `repo/craw_data1`).
    dest="${cmd##* }"
    case "$dest" in
      *".."*) deny "'..' not allowed" ;;
      app|app/*|repo|repo/*|/srv/event-copilot/app|/srv/event-copilot/app/*|/srv/event-copilot/repo|/srv/event-copilot/repo/*) : ;;
      *) deny "rsync target '$dest' outside app/ or repo/" ;;
    esac
    # rrsync re-reads $SSH_ORIGINAL_COMMAND, confines to the root, munges symlinks,
    # and filters dangerous options. -wo = write-only (no read/exfil).
    exec /usr/bin/rrsync -wo /srv/event-copilot
    ;;
  *)
    deny "command not permitted: $cmd"
    ;;
esac
