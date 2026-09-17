#!/bin/bash
# Run the Appium iOS app lifecycle flows (tests/e2e/ios-appium/lifecycle.test.ts) on one simulator.
#
# Usage:
#   KB_SMOKE_USER=<user> tests/e2e/run-ios-lifecycle.sh [device]   # default iPhoneTest
#
# Needs a debug build of the app installed and signed in as KB_SMOKE_USER, and Metro running:
# the flows read app state through Metro's inspector and JS logs from .expo/dev/logs/start.log.
# The receive flow also launches the app on a second simulator signed in to the same account
# (KB_IOS_SENDER_DEVICE, default iPadTest), booting it if needed and shutting it down after.
# Results (json only, no screenshots) land in tests/results/ios-appium-lifecycle-<slug>.
#
# Side effects on the simulators, left in place after the run:
# - the device under test grants the app location "always" (simctl privacy) and simulated
#   locations are set on it;
# - the app is granted notification permission through its own prompt, which makes it upload
#   an APNs sandbox push token for KB_SMOKE_USER's device to the Keybase server;
# - Notification Center keeps the test notifications, and the smoke user's conversation with
#   themselves gains test messages and live location posts;
# - the sender simulator must already have this build installed and signed in; the flow launches
#   it and shuts it down afterwards if it booted it.
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SHARED_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$SHARED_DIR"

NAME="${1:-iPhoneTest}"
SLUG="$(echo "$NAME" | tr '[:upper:]' '[:lower:]')"
DBG="tests/results/ios-appium-lifecycle-$SLUG"
LOG="tests/results/run-lifecycle-$SLUG.log"

if ! curl -sf http://127.0.0.1:8081/status >/dev/null; then
  echo "❌ Metro is not running on 8081 (yarn rn:start)"
  exit 1
fi

xcrun simctl boot "$NAME" 2>/dev/null || true
if ! xcrun simctl bootstatus "$NAME" -b >/dev/null 2>&1; then
  echo "❌ Simulator not found / failed to boot: $NAME"
  exit 1
fi
# Xcode 27 shows simulators in DeviceHub; older Xcodes in Simulator.
open -a Simulator >/dev/null 2>&1 || open -a DeviceHub >/dev/null 2>&1 || true

rm -rf "$DBG"; mkdir -p "$DBG"
echo "▶ Running lifecycle flows on $NAME"
KB_IOS_DEVICE="$NAME" KB_IOS_APPIUM_DEBUG_DIR="$DBG" \
  yarn wdio run tests/e2e/ios-appium/wdio.lifecycle.conf.ts 2>&1 | tee "$LOG"
exit "${PIPESTATUS[0]}"
