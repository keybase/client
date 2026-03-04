#!/bin/bash
# Maestro + React Profiler performance test runner.
#
# Usage: ./run-maestro.sh [--skip-build] [--simulator "name"] [--flow <name>]
#                         [--save-baseline] [--compare <baseline-dir>]
#
# Prerequisites:
#   - Maestro CLI installed: curl -Ls "https://get.maestro.mobile.dev" | bash
#   - Metro running with: yarn rn-start-debug (pipes to /tmp/metro.log)
#
# Options:
#   --skip-build    Skip xcodebuild, just run the Maestro flow
#   --simulator     Simulator name (default: "iPhone 17 Pro")
#   --flow          Maestro flow file relative to shared/.maestro/ (default: performance/perf-inbox-scroll.yaml)
#   --save-baseline Save results to baselines/<git-hash>/
#   --compare DIR   Compare results against a baseline directory

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SHARED_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MAESTRO_DIR="$SHARED_DIR/.maestro"
OUTPUT_DIR="$SCRIPT_DIR/output"
mkdir -p "$OUTPUT_DIR"

SKIP_BUILD=false
SIMULATOR="iPhone 17 Pro"
FLOW="performance/perf-inbox-scroll.yaml"
SAVE_BASELINE=false
COMPARE_DIR=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-build) SKIP_BUILD=true; shift ;;
    --simulator) SIMULATOR="$2"; shift 2 ;;
    --flow) FLOW="$2"; shift 2 ;;
    --save-baseline) SAVE_BASELINE=true; shift ;;
    --compare) COMPARE_DIR="$2"; shift 2 ;;
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

# Save baseline
if [ "$SAVE_BASELINE" = true ]; then
  GIT_HASH=$(git -C "$SHARED_DIR" rev-parse --short HEAD)
  BASELINE_DIR="$SCRIPT_DIR/baselines/$GIT_HASH"
  mkdir -p "$BASELINE_DIR"
  for f in react-profiler.json maestro-fps.json; do
    if [ -f "$OUTPUT_DIR/$f" ]; then
      cp "$OUTPUT_DIR/$f" "$BASELINE_DIR/$f"
    fi
  done
  echo ""
  echo "=== Baseline saved to baselines/$GIT_HASH/ ==="
  ls "$BASELINE_DIR/"
fi

# Compare against baseline
if [ -n "$COMPARE_DIR" ]; then
  # Resolve relative to script dir if not absolute
  if [[ "$COMPARE_DIR" != /* ]]; then
    COMPARE_DIR="$SCRIPT_DIR/$COMPARE_DIR"
  fi
  if [ ! -d "$COMPARE_DIR" ]; then
    echo "Error: Baseline directory not found: $COMPARE_DIR"
    exit 1
  fi
  BASELINE_NAME=$(basename "$COMPARE_DIR")
  echo ""
  echo "=== Comparison vs baseline $BASELINE_NAME ==="

  # Compare FPS
  if [ -f "$COMPARE_DIR/maestro-fps.json" ] && [ -f "$OUTPUT_DIR/maestro-fps.json" ]; then
    python3 -c "
import json, sys
with open('$COMPARE_DIR/maestro-fps.json') as f: old = json.load(f)
with open('$OUTPUT_DIR/maestro-fps.json') as f: new = json.load(f)
for key in ['avg', 'min', 'max', 'p5']:
    o, n = old.get('fps', old).get(key, 0), new.get('fps', new).get(key, 0)
    if o > 0:
        pct = (n - o) / o * 100
        sign = '+' if pct >= 0 else ''
        print(f'FPS {key:>4}:  {o} -> {n}  ({sign}{pct:.1f}%)')
    else:
        print(f'FPS {key:>4}:  {o} -> {n}')
" 2>/dev/null || echo "(could not compare FPS data)"
  else
    echo "(FPS data missing from baseline or current run)"
  fi

  # Compare React Profiler
  if [ -f "$COMPARE_DIR/react-profiler.json" ] && [ -f "$OUTPUT_DIR/react-profiler.json" ]; then
    python3 -c "
import json
with open('$COMPARE_DIR/react-profiler.json') as f: old = json.load(f)
with open('$OUTPUT_DIR/react-profiler.json') as f: new = json.load(f)
for key in ['totalDurationMs', 'totalRenders']:
    o, n = old.get(key, 0), new.get(key, 0)
    if o > 0:
        pct = (n - o) / o * 100
        sign = '+' if pct >= 0 else ''
        print(f'React {key}: {o} -> {n}  ({sign}{pct:.1f}%)')
    else:
        print(f'React {key}: {o} -> {n}')
# Per-component comparison
print()
all_ids = sorted(set(list(old.get('components', {}).keys()) + list(new.get('components', {}).keys())))
if all_ids:
    print(f'{\"Component\":<25} {\"old ms\":>8} {\"new ms\":>8} {\"change\":>8}   {\"old #\":>6} {\"new #\":>6}')
    print('-' * 80)
    for cid in all_ids:
        oc = old.get('components', {}).get(cid, {})
        nc = new.get('components', {}).get(cid, {})
        oms, nms = oc.get('totalMs', 0), nc.get('totalMs', 0)
        ocnt = oc.get('mountCount', 0) + oc.get('updateCount', 0)
        ncnt = nc.get('mountCount', 0) + nc.get('updateCount', 0)
        pct = f'{(nms - oms) / oms * 100:+.0f}%' if oms > 0 else 'new'
        print(f'{cid:<25} {oms:>8.0f} {nms:>8.0f} {pct:>8}   {ocnt:>6} {ncnt:>6}')
" 2>/dev/null || echo "(could not compare React Profiler data)"
  else
    echo "(React Profiler data missing from baseline or current run)"
  fi
fi

echo ""
echo "=== Done ==="
echo "Output: $OUTPUT_DIR/"
