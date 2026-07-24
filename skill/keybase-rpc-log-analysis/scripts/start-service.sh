#!/bin/bash
# Build the service from this checkout and run it in the foreground with debug
# logging going to its own file.
#
#   ./start-service.sh [logfile]      # default /tmp/kb-analysis/service.log
#
# Runs against the REAL home directory, so the account, teams and conversations
# the e2e suite needs are all there. That means it replaces whatever service is
# currently running - it stops the existing one first. It does not log you out.
#
# Run this in its own terminal and leave it in the foreground; ^C stops it. Then
# start the app (yarn desktop:start:hot:e2e) so it attaches to this service
# rather than auto-forking the installed one.
set -euo pipefail

LOGFILE="${1:-/tmp/kb-analysis/service.log}"
mkdir -p "$(dirname "$LOGFILE")"

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO/go"

echo "building from $REPO/go"
go install github.com/keybase/client/go/keybase

BIN="$(go env GOPATH)/bin/keybase"
[ -x "$BIN" ] || { echo "no binary at $BIN"; exit 1; }
echo "built $("$BIN" version -S 2>/dev/null || echo '?')"

# The service does not provide the filesystem itself; it forks kbfs from the same
# bin directory. Without it the Files tab is empty and `keybase git` fails with
# "KBFS client not found", which fails every files-* and git-* e2e test for
# reasons that have nothing to do with the code under test.
if [ ! -x "$(dirname "$BIN")/kbfs" ]; then
  echo
  echo "WARNING: no kbfs binary next to $BIN."
  echo "  Files and git e2e tests will fail with 'KBFS client not found'."
  echo "  To include them:  go install github.com/keybase/client/go/kbfs/kbfsfuse"
  echo "  Otherwise ignore those failures - they are not regressions."
  echo
fi

# The installed service and this one cannot share the socket. --include takes a
# comma separated component list; an unknown flag here just prints usage and
# leaves the old service running, which then quietly wins the socket.
# pgrep -x matches the process NAME. Do not use pgrep -f here: the pattern would
# also match any shell whose command line happens to contain it, including the
# one running this check.
if pgrep -x keybase >/dev/null 2>&1; then
  echo "stopping the running service"
  "$BIN" ctl stop --include service || true
  for _ in $(seq 10); do
    pgrep -x keybase >/dev/null 2>&1 || break
    sleep 1
  done
  if pgrep -x keybase >/dev/null 2>&1; then
    echo "service still running; kill it before rerunning"
    exit 1
  fi
fi

: > "$LOGFILE"
echo "logging to $LOGFILE"
echo "leave this running; start the app in another terminal"
exec "$BIN" -d --log-file="$LOGFILE" service
