#!/bin/bash
# Run the Appium iOS e2e suite across one or more named simulators, SERIALLY
# (a backgrounded sim is render-throttled by macOS, which makes the run crawl),
# then build the merged HTML report.
#
# Usage:
#   KB_SMOKE_USER=<user> tests/e2e/run-ios-appium.sh ["iPhoneTest" "iPadTest" ...]
#
# Defaults to "iPhoneTest" and "iPadTest". The app (keybase.ios) must already be
# installed on each named simulator, and the appium xcuitest driver installed
# (yarn appium driver install xcuitest). Artifacts land in the fixed per-device
# dirs (tests/results/ios-appium-debug-{iphone,ipad}) the report reads; the
# merged report is ios-appium-report.html.
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

booted_udids() {
  xcrun simctl list devices booted -j | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);for(const k in j.devices)for(const d of j.devices[k])if(d.state==="Booted")console.log(d.udid)})'
}

OVERALL=0

for NAME in "${DEVICES[@]}"; do
  DBG="$(dir_for "$NAME")"
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
done

echo "▶ Building merged report"
node tests/e2e/generate-appium-report.mts
exit $OVERALL
