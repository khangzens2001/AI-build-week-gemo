#!/usr/bin/env bash
# Forced command for the CI deploy key (referenced from ~zens/.ssh/authorized_keys
# as command="/srv/event-copilot/deploy-recv.sh",restrict ...). Only permits:
#   1) the rsync server half of an rsync push whose target is /srv/event-copilot/app
#   2) touching the deploy marker (which triggers the web-reload .path unit)
# Anything else is rejected, so a leaked CI key cannot open a shell or run
# arbitrary commands even though the login user (zens) has sudo.
set -euo pipefail
cmd="${SSH_ORIGINAL_COMMAND:-}"

case "$cmd" in
  rsync\ --server\ *)
    case "$cmd" in
      *"/srv/event-copilot/app"*) exec $cmd ;;
      *) echo "deploy-recv: rsync target not allowed" >&2; exit 1 ;;
    esac
    ;;
  "touch /srv/event-copilot/app/.deployed")
    exec touch /srv/event-copilot/app/.deployed
    ;;
  *)
    echo "deploy-recv: command not permitted: $cmd" >&2
    exit 1
    ;;
esac
