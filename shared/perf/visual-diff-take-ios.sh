#!/bin/bash
# Takes screenshots of all app tabs on iOS simulator.
# Uses Maestro to navigate between tabs, xcrun simctl for screenshots.
# Usage: ./visual-diff-take-ios.sh <baseline|current>
#
# Prerequisites:
#   - iOS Simulator booted and app running (logged in)
#   - Maestro installed: curl -Ls "https://get.maestro.mobile.dev" | bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SHARED_DIR="$(dirname "$SCRIPT_DIR")"
FLOW_DIR="$SHARED_DIR/.maestro/visual-diff"
MODE="${1:-}"

if [[ "$MODE" != "baseline" && "$MODE" != "current" ]]; then
  echo "Usage: $0 <baseline|current>"
  echo "  baseline  — capture base branch screenshots"
  echo "  current   — capture feature branch screenshots"
  exit 1
fi

if ! command -v maestro &>/dev/null; then
  echo "ERROR: Maestro not found. Install with: curl -Ls 'https://get.maestro.mobile.dev' | bash"
  exit 1
fi

OUT_DIR="/tmp/visual-diff-ios/$MODE"
rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

screenshot() {
  local name="$1"
  local wait="${2:-1}"
  sleep "$wait"
  xcrun simctl io booted screenshot "$OUT_DIR/${name}.png" 2>/dev/null
  echo "  $name"
}

run_flow() {
  local flow="$1"
  local output
  output=$(maestro test "$FLOW_DIR/$flow" 2>&1) || true
  echo "$output" | grep -E "COMPLETED|FAILED" | tail -3
  if echo "$output" | grep -q "FAILED"; then
    echo "  ERROR: flow $flow failed"
    echo "$output" | grep -A1 "FAILED"
    exit 1
  fi
}

echo "Taking $MODE iOS screenshots..."
echo "Output: $OUT_DIR/"
echo ""

# Launch app and wait for it to be ready
echo "Launching app..."
xcrun simctl launch booted keybase.ios 2>/dev/null || true
sleep 3

# Navigate to each bottom tab and screenshot
for tab in people chat files teams; do
  run_flow "nav-${tab}.yaml"
  screenshot "$tab"
done

# Navigate away first to reset state, then to More menu
run_flow "nav-people.yaml"
run_flow "nav-more.yaml"

for sub in crypto git devices; do
  run_flow "nav-more-${sub}.yaml"
  screenshot "$sub" 3
  run_flow "nav-more-back.yaml"
done

run_flow "nav-more-settings.yaml"
screenshot "settings"

echo ""
echo "Done. Screenshots in $OUT_DIR/"
ls -la "$OUT_DIR/"*.png
