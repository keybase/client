#!/bin/bash
# Run the Appium iOS chat flows (tests/e2e/ios-appium/chat.test.ts) on one simulator.
#
# Usage:
#   KB_SMOKE_USER=<user> KB_SECOND_USER=<user> KB_E2E_TEAM=<team> tests/e2e/run-ios-chat.sh [device]
#
# Needs a debug build of the app installed on the simulator (default iPhoneTest) with both accounts
# signed in on it, Metro running from this checkout, and the host's keybase service signed in to
# both accounts (the flows send "incoming" messages through the host's CLI as KB_SECOND_USER).
#
# The run:
# - relaunches the app so it loads the current bundle, and waits for Metro to serve it;
# - switches the host's keybase CLI to KB_SECOND_USER for the flows and back to KB_SMOKE_USER when it
#   ends, however it ends;
# - is stopped after KB_IOS_CHAT_DEADLINE seconds (default 3600) if it has not finished.
# Results (json only, no screenshots) land in tests/results/ios-appium-chat-<slug>.
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SHARED_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$SHARED_DIR"

: "${KB_SMOKE_USER:?set KB_SMOKE_USER}"
: "${KB_SECOND_USER:?set KB_SECOND_USER}"
: "${KB_E2E_TEAM:?set KB_E2E_TEAM}"
NAME="${1:-iPhoneTest}"
DEADLINE="${KB_IOS_CHAT_DEADLINE:-3600}"
SLUG="$(echo "$NAME" | tr '[:upper:]' '[:lower:]')"
DBG="tests/results/ios-appium-chat-$SLUG"
LOG="tests/results/run-chat-$SLUG.log"
METRO_LOG=".expo/dev/logs/start.log"

restore_cli() {
  if [ "$(keybase whoami 2>/dev/null)" != "$KB_SMOKE_USER" ]; then
    echo "▶ Switching the host's keybase CLI back to the smoke user"
    perl -e 'alarm 60; exec @ARGV' keybase login --switch "$KB_SMOKE_USER" </dev/null
  fi
  if [ "$(keybase whoami 2>/dev/null)" != "$KB_SMOKE_USER" ]; then
    echo "❌ the host's keybase CLI is not back on the smoke user"
  fi
}
RUN=""
WATCHDOG=""
# Stopped from outside: stop what this run started, then exit, which restores the CLI.
stop_run() {
  [ -n "$RUN" ] && kill -- -"$RUN" 2>/dev/null
  [ -n "$WATCHDOG" ] && kill -- -"$WATCHDOG" 2>/dev/null
  exit 143
}
trap restore_cli EXIT
trap stop_run INT TERM

if ! curl -sf -m 5 http://127.0.0.1:8081/status >/dev/null; then
  echo "❌ Metro is not running on 8081 (yarn rn:start)"
  exit 1
fi

xcrun simctl boot "$NAME" 2>/dev/null || true
if ! perl -e 'alarm 120; exec @ARGV' xcrun simctl bootstatus "$NAME" -b >/dev/null 2>&1; then
  echo "❌ Simulator not found / failed to boot: $NAME"
  exit 1
fi
# Xcode 27 shows simulators in DeviceHub; older Xcodes in Simulator.
open -a Simulator >/dev/null 2>&1 || open -a DeviceHub >/dev/null 2>&1 || true

# A session attaches to the app already running, which may be running an old bundle.
echo "▶ Relaunching the app on $NAME for a fresh bundle"
xcrun simctl terminate "$NAME" keybase.ios 2>/dev/null || true
LINES="$(wc -l <"$METRO_LOG" 2>/dev/null || echo 0)"
xcrun simctl launch "$NAME" keybase.ios >/dev/null
END=$(($(date +%s) + 180))
until tail -n +"$((LINES + 1))" "$METRO_LOG" 2>/dev/null | grep -q '"metro:bundling:done"'; do
  if [ "$(date +%s)" -gt "$END" ]; then
    echo "❌ Metro served no bundle within 180s of the relaunch"
    tail -5 "$METRO_LOG"
    exit 1
  fi
  sleep 1
done
echo "▶ Bundle served: $(tail -n +"$((LINES + 1))" "$METRO_LOG" | grep '"metro:bundling:done"' | head -1)"

rm -rf "$DBG"; mkdir -p "$DBG"
echo "▶ Running chat flows on $NAME (deadline ${DEADLINE}s)"
# each in its own process group (set -m), so the deadline can stop wdio, appium and everything
# they started, and the finished run can stop the deadline's sleep
set -m
(
  KB_IOS_DEVICE="$NAME" KB_IOS_APPIUM_DEBUG_DIR="$DBG" \
    yarn wdio run tests/e2e/ios-appium/wdio.chat.conf.ts 2>&1 | tee "$LOG"
  exit "${PIPESTATUS[0]}"
) &
RUN=$!
(
  sleep "$DEADLINE"
  echo "❌ chat flows still running after ${DEADLINE}s; stopping them" | tee -a "$LOG"
  kill -- -"$RUN" 2>/dev/null
) &
WATCHDOG=$!
set +m
wait "$RUN"
STATUS=$?
kill -- -"$WATCHDOG" 2>/dev/null
exit "$STATUS"
