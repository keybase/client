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

ASSUME_YES="${KB_RPC_LOG_ASSUME_YES:-}"
ARGS=()
for arg in "$@"; do
  case "$arg" in
    --yes|-y) ASSUME_YES=1 ;;
    *) ARGS+=("$arg") ;;
  esac
done

LOGFILE="${ARGS[0]:-/tmp/kb-analysis/service.log}"
mkdir -p "$(dirname "$LOGFILE")"

# -P resolves symlinks before collapsing "..": this script is normally reached
# through .claude/skills -> skill, and a logical cd would land in .claude/
REPO="$(cd -P "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO/go"

echo "building from $REPO/go"
go install github.com/keybase/client/go/keybase

# go install honours GOBIN when it is set and only falls back to GOPATH/bin
# otherwise, so asking for GOPATH unconditionally looks in the wrong place on
# any setup that sets GOBIN.
GOBIN_DIR="$(go env GOBIN)"
BIN="${GOBIN_DIR:-$(go env GOPATH)/bin}/keybase"
[ -x "$BIN" ] || { echo "no binary at $BIN"; exit 1; }
echo "built $("$BIN" version -S 2>/dev/null || echo '?')"

# The service does not provide the filesystem itself; it forks kbfs from the same
# bin directory. Without it the Files tab is empty and `keybase git` fails with
# "KBFS client not found", which fails every files-* and git-* e2e test for
# reasons that have nothing to do with the code under test.
#
# The name matters: on darwin the service looks for a binary called "kbfs"
# (install_darwin.go), but the package that builds it is kbfsfuse, so a plain
# go install leaves you with kbfsfuse and the service still finds nothing. Hence
# the link in the hint below.
if [ ! -x "$(dirname "$BIN")/kbfs" ]; then
  echo
  echo "WARNING: no kbfs binary next to $BIN."
  echo "  Files and git e2e tests will fail with 'KBFS client not found'."
  echo "  To include them:"
  echo "    go install github.com/keybase/client/go/kbfs/kbfsfuse"
  echo "    ln -s $(dirname "$BIN")/kbfsfuse $(dirname "$BIN")/kbfs"
  echo "  Otherwise ignore those failures - they are not regressions."
  echo
fi

# The installed service and this one cannot share the socket. --include takes a
# comma separated component list; an unknown flag here just prints usage and
# leaves the old service running, which then quietly wins the socket.
# pgrep -x matches the process NAME. Do not use pgrep -f here: the pattern would
# also match any shell whose command line happens to contain it, including the
# one running this check.
#
# Stopping the service is disruptive to whoever is using the app right now, so
# it needs an explicit ok unless the caller opted out with --yes /
# KB_RPC_LOG_ASSUME_YES=1. With no tty there is nobody to ask, so abort rather
# than stop it behind the user's back.
if pgrep -x keybase >/dev/null 2>&1; then
  if [ -z "$ASSUME_YES" ]; then
    echo "a keybase service is already running (pids: $(pgrep -x keybase | tr '\n' ' '))"
    echo "continuing stops it with '$BIN ctl stop --include service'."
    if [ ! -t 0 ]; then
      echo "not interactive; refusing to stop it. rerun with --yes or KB_RPC_LOG_ASSUME_YES=1"
      exit 1
    fi
    printf 'stop the running service? [y/N] '
    read -r REPLY
    case "$REPLY" in
      y|Y|yes|YES) ;;
      *) echo "aborted; the running service was left alone"; exit 1 ;;
    esac
  fi
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
echo
echo "NOTE: a newly built binary has a new code signature, so macOS will prompt"
echo "  for keychain access on first run. Until someone clicks Allow the service"
echo "  cannot finish bootstrapping, the app sits on its splash screen, and every"
echo "  test fails for a reason that has nothing to do with the code. Watch for the"
echo "  prompt before walking away."
echo
echo "leave this running; start the app in another terminal"
exec "$BIN" -d --log-file="$LOGFILE" service
