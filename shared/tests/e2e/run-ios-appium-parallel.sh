#!/bin/bash
# Run the Appium iOS e2e suite across devices IN PARALLEL — each device gets its
# own appium server (distinct port), its own debug dir, and runs concurrently;
# then the merged per-device HTML report is built.
#
# CAVEAT: macOS render-throttles backgrounded simulator windows, so two sims
# running at once can each be slower than one in the foreground — on a single Mac
# with sim UIs this may NOT beat run-ios-appium.sh (serial). True parallel speedup
# wants separate machines or headless/cloud sims. Measure before relying on it.
#
# Usage: KB_SMOKE_USER=<user> tests/e2e/run-ios-appium-parallel.sh ["iPhoneTest" "iPadTest" ...]
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SHARED_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$SHARED_DIR"

DEVICES=("$@")
if [ ${#DEVICES[@]} -eq 0 ]; then
  DEVICES=("iPhoneTest" "iPadTest")
fi

# iPhone results always go to -iphone, iPad to -ipad — the report only reads
# these two dirs, so each run overwrites its device's slot in the report.
dir_for() { case "$1" in *[Pp]ad*) echo "tests/results/ios-appium-debug-ipad";; *) echo "tests/results/ios-appium-debug-iphone";; esac }

# Boot every device up front (all stay booted — that's the throttling tradeoff).
for NAME in "${DEVICES[@]}"; do xcrun simctl boot "$NAME" 2>/dev/null || true; done
for NAME in "${DEVICES[@]}"; do
  xcrun simctl bootstatus "$NAME" -b >/dev/null 2>&1 || echo "⚠️  $NAME failed to boot"
done
open -a Simulator >/dev/null 2>&1 || true

BASE_PORT=4723
PIDS=()
i=0
for NAME in "${DEVICES[@]}"; do
  DBG="$(dir_for "$NAME")"
  SLUG="${DBG##*-}"
  rm -rf "$DBG"; mkdir -p "$DBG"
  P=$((BASE_PORT + i)); i=$((i + 1))
  ORIENT=""; case "$NAME" in *[Pp]ad*) ORIENT="LANDSCAPE";; esac
  echo "▶ [$NAME] appium port $P${ORIENT:+ ($ORIENT)} → log tests/results/run-$SLUG.log"
  KB_IOS_DEVICE="$NAME" KB_APPIUM_PORT="$P" KB_IOS_APPIUM_DEBUG_DIR="$DBG" KB_IOS_ORIENTATION="$ORIENT" \
    yarn wdio run tests/e2e/ios-appium/wdio.conf.ts >"tests/results/run-$SLUG.log" 2>&1 &
  PIDS+=("$!")
done

OVERALL=0
for pid in "${PIDS[@]}"; do
  wait "$pid" || OVERALL=1
done

echo "▶ Building merged report"
node tests/e2e/generate-appium-report.mts
exit $OVERALL
