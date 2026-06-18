#!/bin/bash
# Run the Appium Android e2e suite on the first connected adb device (or
# KB_ANDROID_SERIAL), then build the merged HTML report.
#
# Usage:
#   KB_SMOKE_USER=<user> tests/e2e/run-android-appium.sh
#
# The app (io.keybase.ossifrage) must already be installed and logged into the
# smoke account, and the appium uiautomator2 driver installed
# (yarn appium driver install uiautomator2). Artifacts land in
# tests/results/android-appium-debug, which the report reads.
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SHARED_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$SHARED_DIR"

DBG="tests/results/android-appium-debug"
rm -rf "$DBG"; mkdir -p "$DBG"

# When the run exits nonzero having produced no per-test artifacts (e.g. the
# Appium/uiautomator2 session never started), drop a _run-error.json the report
# renders as a failed card — otherwise the empty dir is silently filtered out and
# the device just disappears. Mines the run log for a concise message.
write_run_error() {
  local dir="$1" log="$2"
  ls "$dir"/*.json >/dev/null 2>&1 && return  # real test artifacts exist; nothing to flag
  local msg
  msg="$(grep -hoE 'Failed to create a session.*|WebDriverError:.*' "$log" 2>/dev/null | head -1)"
  [ -z "$msg" ] && msg="$(tail -3 "$log" 2>/dev/null | tr '\n' ' ' | sed 's/  */ /g')"
  [ -z "$msg" ] && msg="Run exited nonzero with no test artifacts."
  node -e 'require("fs").writeFileSync(process.argv[1],JSON.stringify({error:process.argv[2]}))' "$dir/_run-error.json" "$msg"
}

if ! adb get-state >/dev/null 2>&1; then
  echo "❌ No Android device reachable via adb — plug one in (adb devices)"
  # Surface the no-device failure in the report too, instead of an empty section.
  node -e 'require("fs").writeFileSync(process.argv[1],JSON.stringify({error:process.argv[2]}))' \
    "$DBG/_run-error.json" "No Android device reachable via adb — plug one in (adb devices)."
  node tests/e2e/generate-appium-report.mts android || true
  exit 1
fi

OVERALL=0
echo "▶ Running suite on $(adb devices | sed -n '2p' | awk '{print $1}')"
LOG="tests/results/run-android.log"
# tee so the console still streams while we keep a log to mine for the error marker.
KB_ANDROID_APPIUM_DEBUG_DIR="$DBG" \
  yarn wdio run tests/e2e/ios-appium/wdio.android.conf.ts 2>&1 | tee "$LOG"
if [ "${PIPESTATUS[0]}" -ne 0 ]; then OVERALL=1; write_run_error "$DBG" "$LOG"; fi

echo "▶ Building merged report"
node tests/e2e/generate-appium-report.mts android || OVERALL=1
exit $OVERALL
