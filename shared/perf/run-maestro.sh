#!/bin/bash
# Maestro + React Profiler performance test runner.
#
# Usage: ./run-maestro.sh [--skip-build] [--simulator "name"] [--flow <name>]
#
# Prerequisites:
#   - Maestro CLI installed: curl -Ls "https://get.maestro.mobile.dev" | bash
#   - Metro running with: yarn rn-start-debug (pipes to /tmp/metro.log)
#
# Options:
#   --skip-build    Skip xcodebuild, just run the Maestro flow
#   --simulator     Simulator name (default: "iPhone 17 Pro")
#   --flow          Maestro flow file relative to shared/.maestro/ (default: performance/perf-inbox-scroll.yaml)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SHARED_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MAESTRO_DIR="$SHARED_DIR/.maestro"
OUTPUT_DIR="$SCRIPT_DIR/output"
mkdir -p "$OUTPUT_DIR"

SKIP_BUILD=false
SIMULATOR="iPhone 17 Pro"
FLOW="performance/perf-inbox-scroll.yaml"

while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-build) SKIP_BUILD=true; shift ;;
    --simulator) SIMULATOR="$2"; shift 2 ;;
    --flow) FLOW="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

FLOW_PATH="$MAESTRO_DIR/$FLOW"
if [ ! -f "$FLOW_PATH" ]; then
  echo "Error: Flow file not found: $FLOW_PATH"
  exit 1
fi

# Check Metro is running
if ! grep -q "" /tmp/metro.log 2>/dev/null; then
  echo "Error: /tmp/metro.log not found. Start Metro with: cd shared && yarn rn-start-debug"
  exit 1
fi

# Check Maestro is installed
if ! command -v maestro &>/dev/null; then
  # Check ~/.maestro/bin too
  if [ -x "$HOME/.maestro/bin/maestro" ]; then
    export PATH="$HOME/.maestro/bin:$PATH"
  else
    echo "Error: Maestro CLI not found. Install with: curl -Ls \"https://get.maestro.mobile.dev\" | bash"
    exit 1
  fi
fi

# Clear metro log for fresh profiler data
echo "" > /tmp/metro.log

echo "=== Maestro Performance Test ==="
echo "Simulator: $SIMULATOR"
echo "Flow: $FLOW"
echo ""

# Boot simulator
echo "Booting simulator..."
xcrun simctl boot "$SIMULATOR" 2>/dev/null || true

# Build app
if [ "$SKIP_BUILD" = false ]; then
  echo "Building app..."
  xcodebuild \
    -workspace "$SHARED_DIR/ios/Keybase.xcworkspace" \
    -scheme Keybase \
    -configuration Debug \
    -destination "platform=iOS Simulator,name=$SIMULATOR" \
    build 2>&1 | tail -5
  echo "Build complete."
else
  echo "Skipping build (--skip-build)"
fi

echo ""
echo "Running Maestro flow..."
maestro test "$FLOW_PATH" 2>&1 | tee "$OUTPUT_DIR/maestro.log"

# Wait for console.log flush
echo ""
echo "Waiting for profiler flush..."
sleep 3

# Extract React Profiler data
echo ""
echo "=== React Profiler Results ==="
PROFILER_LINE=$(grep -a 'PERF_REACT_PROFILER:' /tmp/metro.log | tail -1 || true)
if [ -n "$PROFILER_LINE" ]; then
  PROFILER_JSON=$(echo "$PROFILER_LINE" | sed 's/.*PERF_REACT_PROFILER://')
  echo "$PROFILER_JSON" | python3 -m json.tool 2>/dev/null || echo "$PROFILER_JSON"
  echo "$PROFILER_JSON" > "$OUTPUT_DIR/react-profiler.json"
  echo "Saved to: $OUTPUT_DIR/react-profiler.json"
else
  echo "(no PERF_REACT_PROFILER data found in /tmp/metro.log)"
fi

# Extract FPS data
echo ""
echo "=== FPS Data ==="
APP_CONTAINER=$(xcrun simctl get_app_container booted keybase.ios data 2>/dev/null || true)
if [ -n "$APP_CONTAINER" ]; then
  FPS_FILE="$APP_CONTAINER/tmp/perf-fps.json"
  if [ -f "$FPS_FILE" ]; then
    cp "$FPS_FILE" "$OUTPUT_DIR/maestro-fps.json"
    echo "FPS data saved to: $OUTPUT_DIR/maestro-fps.json"
    python3 -m json.tool "$OUTPUT_DIR/maestro-fps.json" 2>/dev/null || cat "$OUTPUT_DIR/maestro-fps.json"
  else
    echo "(no FPS data file found at $FPS_FILE)"
  fi
else
  echo "(could not find app container — is the simulator running?)"
fi

echo ""
echo "=== Done ==="
echo "Output: $OUTPUT_DIR/"
