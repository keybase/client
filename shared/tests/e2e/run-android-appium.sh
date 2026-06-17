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

if ! adb get-state >/dev/null 2>&1; then
  echo "❌ No Android device reachable via adb — plug one in (adb devices)"
  exit 1
fi

OVERALL=0
echo "▶ Running suite on $(adb devices | sed -n '2p' | awk '{print $1}')"
KB_ANDROID_APPIUM_DEBUG_DIR="$DBG" \
  yarn wdio run tests/e2e/ios-appium/wdio.android.conf.ts || OVERALL=1

echo "▶ Building merged report"
node tests/e2e/generate-appium-report.mts android || OVERALL=1
exit $OVERALL
