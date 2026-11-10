#!/bin/bash
# Live watch of a running release gate, for a Monitor: one line per event worth acting on, nothing per
# passing test. Prints each failed test as it fails, each phase's result, the gate stopping its run
# early, and exits once the release summary is written.
#
#   watch-run.sh desktop <gate log>    (the log KB_E2E_NO_OPEN=1 yarn test:e2e:desktop:release wrote)
#   watch-run.sh ios <gate log>
#
# Desktop failures come from Playwright's list lines in the gate log. iOS prints its results only at
# the end, so its failures come from the attempt records the gate writes as each attempt ends
# (tests/results/ios-report/attempts/*.json).
set -u
kind=${1:?desktop or ios}
log=${2:?the gate log}
here="$(cd "$(dirname "$0")" && pwd)"
attempts="$here/../../shared/tests/results/ios-report/attempts"

case "$kind" in
  desktop | ios) ;;
  *) echo "watch-run.sh: the first argument is desktop or ios, not $kind" >&2; exit 2 ;;
esac

# the gate's own lines: phase results, the run stopped early, the summary
# tail feeds grep through a process substitution, so $! is tail itself and the trap below stops it
tail -n +1 -F "$log" 2>/dev/null > >(grep --line-buffered -E \
  '^\[(release|ios-release)\] [a-z]+: (ok|FAILED)|stopping the run|^  ✘ ') &
tailer=$!
disown "$tailer"

# iOS: attempt records written since this watch began, failures only. The gate numbers its records
# afresh each run, so a record is new by its time, not its name.
seen="$(mktemp -t watch-run)"
since="$(mktemp -t watch-run-since)"
trap 'kill $tailer 2>/dev/null; rm -f "$seen" "$since"' EXIT

scan() {
  [ "$kind" = ios ] && [ -d "$attempts" ] || return 0
  for f in $(find "$attempts" -maxdepth 1 -name '*.json' -newer "$since" 2>/dev/null | sort); do
    grep -qxF "$f" "$seen" && continue
    python3 -I "$here/attempt-line.py" "$f" && echo "$f" >> "$seen"
  done
}

while ! grep -q '^total .*run id' "$log" 2>/dev/null; do
  scan
  sleep 5
done
# attempts that ended between the last pass and the summary
scan
# the summary block, once
sed -n '/^=== release summary/,/^total /p' "$log"
