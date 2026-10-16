#!/bin/bash
# Run the iOS share-source matrix (tests/e2e/ios-appium/share.test.ts) on one simulator. Local only.
#
# Usage:
#   KB_SMOKE_USER=<user> tests/e2e/run-ios-share.sh [device]
#
# Needs a signed debug build of the app installed on the simulator (default iPhoneTest) and signed in
# as KB_SMOKE_USER, and Metro running from this checkout. Build with signing: an unsigned build
# (CODE_SIGNING_ALLOWED=NO) has no app group, and installing one deletes the group's data, which
# signs the app out.
#
# Each source shares from Photos, Safari, Files, Contacts or Maps into Keybase, checks the share
# extension's manifest, then sends into the conversation whose only participant is KB_SMOKE_USER and
# checks what arrived. KB_SHARE_NO_SEND=1 stops every source at the app's share screen instead.
# KB_IOS_GREP picks sources by title. The run:
# - makes the assets with ios-appium/share/make-assets.sh into a temp dir (KB_SHARE_ASSETS to reuse);
# - relaunches the app so it runs the current bundle;
# - is stopped after KB_IOS_SHARE_DEADLINE seconds (default 5400) if it has not finished.
# Results (a result json per source, a screenshot per test) land in tests/results/ios-appium-share-<slug>.
# Photos keeps the media each source adds.
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SHARED_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$SHARED_DIR"

: "${KB_SMOKE_USER:?set KB_SMOKE_USER}"
NAME="${1:-iPhoneTest}"
DEADLINE="${KB_IOS_SHARE_DEADLINE:-5400}"
SLUG="$(echo "$NAME" | tr '[:upper:]' '[:lower:]')"
DBG="tests/results/ios-appium-share-$SLUG"
LOG="tests/results/run-share-$SLUG.log"

RUN=""
WATCHDOG=""
MADE_ASSETS=""
UDID=""
stop_run() {
  [ -n "$RUN" ] && kill -- -"$RUN" 2>/dev/null
  [ -n "$WATCHDOG" ] && kill -- -"$WATCHDOG" 2>/dev/null
  # appium starts WebDriverAgent's xcodebuild in a process group of its own
  [ -n "$UDID" ] && pkill -f "xcodebuild test-without-building .*id=$UDID" 2>/dev/null
  exit 143
}
trap stop_run INT TERM HUP ALRM
# Only a dir this script generated: a caller's KB_SHARE_ASSETS is left alone.
trap '[ -n "$MADE_ASSETS" ] && rm -rf "$MADE_ASSETS"' EXIT

if ! curl -sf -m 5 http://127.0.0.1:8081/status >/dev/null; then
  echo "❌ Metro is not running on 8081 (yarn rn:start)"
  exit 1
fi

UDID="$(xcrun simctl list devices available | sed -n "s/^ *$NAME (\([-0-9A-F]*\)).*/\1/p" | head -1)"
xcrun simctl boot "$NAME" 2>/dev/null || true
if ! perl -e 'alarm 120; exec @ARGV' xcrun simctl bootstatus "$NAME" -b >/dev/null 2>&1; then
  echo "❌ Simulator not found / failed to boot: $NAME"
  exit 1
fi
# Xcode 27 shows simulators in DeviceHub; older Xcodes in Simulator.
open -a Simulator >/dev/null 2>&1 || open -a DeviceHub >/dev/null 2>&1 || true

if ! xcrun simctl get_app_container "$NAME" keybase.ios groups 2>/dev/null | grep -q '^group.keybase'; then
  echo "❌ the installed app has no group.keybase container: install a signed build"
  exit 1
fi

if [ -z "${KB_SHARE_ASSETS:-}" ]; then
  KB_SHARE_ASSETS="$(mktemp -d /tmp/kb-share-assets.XXXXXX)"
  MADE_ASSETS="$KB_SHARE_ASSETS"
  bash "$SCRIPT_DIR/ios-appium/share/make-assets.sh" "$KB_SHARE_ASSETS" || exit 1
fi
export KB_SHARE_ASSETS

echo "▶ Relaunching the app on $NAME for a fresh bundle"
xcrun simctl terminate "$NAME" keybase.ios 2>/dev/null || true
xcrun simctl launch "$NAME" keybase.ios >/dev/null
END=$(($(date +%s) + 180))
until curl -s -m 3 http://127.0.0.1:8081/json/list | grep -q "\"deviceName\": \"$NAME\""; do
  if [ "$(date +%s)" -gt "$END" ]; then
    echo "❌ the relaunched app did not connect to Metro within 180s"
    exit 1
  fi
  sleep 1
done

rm -rf "$DBG"; mkdir -p "$DBG"
echo "▶ Running the share matrix on $NAME (deadline ${DEADLINE}s)"
set -m
(
  KB_IOS_DEVICE="$NAME" KB_IOS_APPIUM_DEBUG_DIR="$DBG" \
    yarn wdio run tests/e2e/ios-appium/wdio.share.conf.ts 2>&1 | tee "$LOG"
  exit "${PIPESTATUS[0]}"
) &
RUN=$!
(
  sleep "$DEADLINE"
  echo "❌ share matrix still running after ${DEADLINE}s; stopping it" | tee -a "$LOG"
  kill -- -"$RUN" 2>/dev/null
) &
WATCHDOG=$!
set +m
wait "$RUN"
STATUS=$?
kill -- -"$WATCHDOG" 2>/dev/null
exit "$STATUS"
