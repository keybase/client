#!/bin/bash
# Run the iOS e2e Maestro suite across multiple simulators, then build ONE
# combined HTML report with a section per device (screenshots pulled from every
# device's debug folder).
#
# Usage:
#   tests/e2e/run-ios-devices.sh ["iPhone 17 Pro" "iPad" ...]
#
# Defaults to "iPhoneTest" and "iPadTest". App must already be built/installed
# (appId keybase.ios) on each named simulator. Each device writes its own debug
# output to tests/results/ios-debug-<slug>/; the merged report is written to
# tests/results/ios-report.html.
#
# Devices are matched by simulator NAME via `xcrun simctl`. Each is booted if
# needed; the suite runs serially so screenshots don't interleave.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SHARED_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$SHARED_DIR"

DEVICES=("$@")
if [ ${#DEVICES[@]} -eq 0 ]; then
  DEVICES=("iPhoneTest" "iPadTest")
fi

slugify() { echo "$1" | tr '[:upper:] ' '[:lower:]-'; }

udid_for() {
  xcrun simctl list devices available -j \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);const want=process.argv[1];for(const k in j.devices)for(const d of j.devices[k])if(d.name===want){process.stdout.write(d.udid);return}})' "$1"
}

OVERALL=0
DEBUG_DIRS=""   # accumulates "label=dir" pairs for the merged report

for NAME in "${DEVICES[@]}"; do
  SLUG="$(slugify "$NAME")"
  UDID="$(udid_for "$NAME")"
  if [ -z "$UDID" ]; then
    echo "❌ Simulator not found: $NAME"
    OVERALL=1
    continue
  fi

  # Only the target sim should be booted: a backgrounded sim window gets
  # render-throttled by macOS, which makes Maestro crawl on every screen.
  echo "▶ Shutting down other sims, booting $NAME ($UDID)"
  for OTHER in $(xcrun simctl list devices booted -j \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);for(const k in j.devices)for(const d of j.devices[k])console.log(d.udid)})'); do
    [ "$OTHER" != "$UDID" ] && xcrun simctl shutdown "$OTHER" 2>/dev/null
  done
  xcrun simctl boot "$UDID" 2>/dev/null
  xcrun simctl bootstatus "$UDID" >/dev/null 2>&1
  open -a Simulator --args -CurrentDeviceUDID "$UDID" 2>/dev/null

  DEBUG_DIR="tests/results/ios-debug-$SLUG"
  rm -rf "$DEBUG_DIR"

  # Tablets run in landscape: prepend an orientation flow before the suite.
  ORIENT_FLOW=()
  case "$NAME" in
    *[iI][pP]ad*) ORIENT_FLOW=(.maestro/e2e/orient-landscape.yaml) ;;
  esac

  echo "▶ Running e2e on $NAME"
  MAESTRO_CLI_NO_ANALYTICS=1 maestro --device "$UDID" test \
    --config .maestro/e2e/config.yaml \
    --debug-output "$DEBUG_DIR" \
    --flatten-debug-output \
    --env KB_SMOKE_USER="${KB_SMOKE_USER:-}" \
    .maestro/e2e/setup.yaml "${ORIENT_FLOW[@]}" .maestro/e2e/flows/
  STATUS=$?
  [ $STATUS -ne 0 ] && OVERALL=$STATUS

  [ -n "$DEBUG_DIRS" ] && DEBUG_DIRS="$DEBUG_DIRS,"
  DEBUG_DIRS="$DEBUG_DIRS$NAME=$DEBUG_DIR"
done

echo "▶ Building combined report"
KB_IOS_DEBUG_DIRS="$DEBUG_DIRS" node tests/e2e/generate-ios-report.mts
open tests/results/ios-report.html

exit $OVERALL
