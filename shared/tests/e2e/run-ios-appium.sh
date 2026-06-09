#!/bin/bash
# Run the Appium iOS e2e suite across one or more named simulators, SERIALLY
# (a backgrounded sim is render-throttled by macOS, which makes the run crawl),
# then build ONE merged HTML report with a section per device.
#
# Usage:
#   KB_SMOKE_USER=<user> tests/e2e/run-ios-appium.sh ["iPhoneTest" "iPadTest" ...]
#
# Defaults to "iPhoneTest" and "iPadTest". The app (keybase.ios) must already be
# installed on each named simulator, and the appium xcuitest driver installed
# (yarn appium driver install xcuitest). Each device writes its own debug dir
# (tests/results/ios-appium-debug-<slug>); the merged report is ios-appium-report.html.
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SHARED_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$SHARED_DIR"

DEVICES=("$@")
if [ ${#DEVICES[@]} -eq 0 ]; then
  DEVICES=("iPhoneTest" "iPadTest")
fi

slugify() { echo "$1" | tr '[:upper:] ' '[:lower:]-'; }

booted_udids() {
  xcrun simctl list devices booted -j | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);for(const k in j.devices)for(const d of j.devices[k])if(d.state==="Booted")console.log(d.udid)})'
}

OVERALL=0
DIRS="" # accumulates "Label=dir" pairs for the merged report

for NAME in "${DEVICES[@]}"; do
  SLUG="$(slugify "$NAME")"
  DBG="tests/results/ios-appium-debug-$SLUG"
  rm -rf "$DBG"; mkdir -p "$DBG"

  # Only the target sim should be booted — a backgrounded sim window gets
  # render-throttled by macOS, which makes the whole run crawl.
  echo "▶ Booting $NAME (shutting down others)"
  for OTHER in $(booted_udids); do
    xcrun simctl shutdown "$OTHER" 2>/dev/null
  done
  if ! xcrun simctl boot "$NAME" 2>/dev/null; then
    # already booted, or invalid name; bootstatus will tell us
    :
  fi
  if ! xcrun simctl bootstatus "$NAME" -b >/dev/null 2>&1; then
    echo "❌ Simulator not found / failed to boot: $NAME — skipping"
    OVERALL=1
    continue
  fi
  open -a Simulator >/dev/null 2>&1 || true

  # iPad runs in landscape; phones stay portrait.
  ORIENT=""; case "$NAME" in *[Pp]ad*) ORIENT="LANDSCAPE";; esac

  echo "▶ Running suite on $NAME${ORIENT:+ ($ORIENT)}"
  KB_IOS_DEVICE="$NAME" KB_IOS_APPIUM_DEBUG_DIR="$DBG" KB_IOS_ORIENTATION="$ORIENT" \
    yarn wdio run tests/e2e/ios-appium/wdio.conf.ts || OVERALL=1
  DIRS="${DIRS:+$DIRS,}$NAME=$DBG"
done

echo "▶ Building merged report"
KB_IOS_APPIUM_DEBUG_DIRS="$DIRS" node tests/e2e/generate-appium-report.mts
exit $OVERALL
