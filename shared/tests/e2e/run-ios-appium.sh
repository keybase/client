#!/bin/bash
# Run the Appium iOS e2e suite across one or more named simulators, SERIALLY
# (a backgrounded sim is render-throttled by macOS, which makes the run crawl),
# then build the merged HTML report.
#
# Usage:
#   KB_SMOKE_USER=<user> tests/e2e/run-ios-appium.sh ["iPhoneTest" "iPadTest" ...]
#
# Defaults to "iPhoneTest" "iPadTest" "iPhoneTestOld" "iPadTestOld". The app
# (keybase.ios) must already be installed on each named simulator, and the appium
# xcuitest driver installed (yarn appium driver install xcuitest). Artifacts land
# in the fixed per-device dirs (tests/results/ios-appium-debug-{iphone,ipad,iphone-old,ipad-old})
# the report reads; the merged report is ios-appium-report.html.
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SHARED_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$SHARED_DIR"

DEVICES=("$@")
if [ ${#DEVICES[@]} -eq 0 ]; then
  DEVICES=("iPhoneTest" "iPadTest" "iPhoneTestOld" "iPadTestOld")
fi

# Each device name maps to one of four fixed slot dirs by form factor (pad vs
# phone) plus an -old suffix for the older-OS sims (names ending in "Old"). The
# report only reads these dirs, so each run overwrites its device's slot.
dir_for() {
  local base; case "$1" in *[Pp]ad*) base="ipad";; *) base="iphone";; esac
  case "$1" in *[Oo]ld) base="$base-old";; esac
  echo "tests/results/ios-appium-debug-$base"
}

# When a device run exits nonzero having produced no per-test artifacts (e.g. the
# Appium/WDA session never started), drop a _run-error.json the report renders as
# a failed card — otherwise the empty dir is silently filtered out and the device
# just disappears from the report. Pulls a concise message from the run log.
write_run_error() {
  local dir="$1" log="$2"
  ls "$dir"/*.json >/dev/null 2>&1 && return  # real test artifacts exist; nothing to flag
  local msg
  msg="$(grep -hoE 'Failed to create a session.*|WebDriverError:.*' "$log" 2>/dev/null | head -1)"
  [ -z "$msg" ] && msg="$(tail -3 "$log" 2>/dev/null | tr '\n' ' ' | sed 's/  */ /g')"
  [ -z "$msg" ] && msg="Run exited nonzero with no test artifacts."
  node -e 'require("fs").writeFileSync(process.argv[1],JSON.stringify({error:process.argv[2]}))' "$dir/_run-error.json" "$msg"
}

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
  SLUG="${DBG##*ios-appium-debug-}"
  LOG="tests/results/run-$SLUG.log"
  # tee so the console still streams the run while we keep a log to mine for the
  # error marker; PIPESTATUS[0] is wdio's exit (tee always succeeds).
  KB_IOS_DEVICE="$NAME" KB_IOS_APPIUM_DEBUG_DIR="$DBG" KB_IOS_ORIENTATION="$ORIENT" \
    yarn wdio run tests/e2e/ios-appium/wdio.conf.ts 2>&1 | tee "$LOG"
  if [ "${PIPESTATUS[0]}" -ne 0 ]; then OVERALL=1; write_run_error "$DBG" "$LOG"; fi
done

echo "▶ Building merged report"
node tests/e2e/generate-appium-report.mts || OVERALL=1
exit $OVERALL
