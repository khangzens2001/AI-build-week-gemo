#!/usr/bin/env bash
# Forced command for the CI deploy key (referenced from ~zens/.ssh/authorized_keys
# as: command="/srv/event-copilot/deploy-recv.sh",restrict ssh-ed25519 ...).
#
# THREAT MODEL: the private key lives in a third-party-owned GitHub repo's
# secrets. A leaked key must NOT be able to (a) get a shell, (b) read files off
# the VM (e.g. the live secrets in ../shared/web.env), or (c) write anywhere
# except the app bundle dir. The `restrict` flag handles ssh features; this
# script handles the rsync surface.
#
# Allowed, and nothing else:
#   1) rsync RECEIVER ONLY (push to VM) whose every path token is confined to
#      /srv/event-copilot/app, with no `--sender` and no `..` traversal.
#   2) `touch /srv/event-copilot/app/.deployed` (fires the web-reload .path unit).
set -euo pipefail
cmd="${SSH_ORIGINAL_COMMAND:-}"

deny() { echo "deploy-recv: denied: $1" >&2; exit 1; }

case "$cmd" in
  "touch /srv/event-copilot/app/.deployed")
    exec touch /srv/event-copilot/app/.deployed
    ;;
  "rsync --server "*)
    # Must be the RECEIVER half (client is pushing). The sender half — used to
    # READ files off the box — always carries `--sender`. Reject it outright so
    # the key can never exfiltrate web.env or anything else.
    case " $cmd " in
      *" --sender "*) deny "rsync --sender (read) not allowed" ;;
    esac
    # No path traversal anywhere in the command.
    case "$cmd" in
      *".."*) deny "'..' not allowed" ;;
    esac
    # The destination is the final whitespace-delimited token. It must live
    # under the app dir (rsync sends it absolute, e.g. /srv/event-copilot/app/).
    dest="${cmd##* }"
    case "$dest" in
      /srv/event-copilot/app|/srv/event-copilot/app/*) : ;;
      *) deny "rsync target '$dest' outside /srv/event-copilot/app" ;;
    esac
    # Word-split is intentional (rsync args); not run via a shell, so ';' / '|'
    # in $cmd cannot inject — they'd just be literal rsync args and fail.
    exec $cmd
    ;;
  *)
    deny "command not permitted: $cmd"
    ;;
esac
