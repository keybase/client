#!/bin/bash
# Maestro + React Profiler performance test runner.
#
# Usage:
#   Capture:  ./run-maestro.sh [--build] [--simulator "name"] [--flow <name>] [--runs N]
#   Compare:  ./run-maestro.sh --compare <baseline-a> <baseline-b>
#
# Prerequisites:
#   - Maestro CLI installed: curl -Ls "https://get.maestro.mobile.dev" | bash
#   - Metro running with: yarn rn-start-debug (pipes to /tmp/metro.log)
#
# Options:
#   --build         Build the app before running (default: skip build)
#   --simulator     Simulator name (default: "iPhone 17 Pro")
#   --flow          Maestro flow file relative to shared/.maestro/ (default: performance/perf-inbox-scroll.yaml)
#   --runs N        Run the test N times and report median (default: 3)
#   --compare A B   Compare two existing baselines (no test run)
#
# Capture mode runs N iterations, picks the median by totalDurationMs,
# and saves that run's results to baselines/<git-hash>/.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SHARED_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MAESTRO_DIR="$SHARED_DIR/.maestro"
OUTPUT_DIR="$SCRIPT_DIR/output"
mkdir -p "$OUTPUT_DIR"

DO_BUILD=false
SIMULATOR="iPhone 17 Pro"
FLOW="performance/perf-inbox-scroll.yaml"
NUM_RUNS=3
COMPARE_A=""
COMPARE_B=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --build) DO_BUILD=true; shift ;;
    --simulator) SIMULATOR="$2"; shift 2 ;;
    --flow) FLOW="$2"; shift 2 ;;
    --runs) NUM_RUNS="$2"; shift 2 ;;
    --compare)
      COMPARE_A="$2"
      COMPARE_B="${3:-}"
      if [ -z "$COMPARE_B" ]; then
        echo "Error: --compare requires two arguments: --compare <baseline-a> <baseline-b>"
        exit 1
      fi
      shift 3
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done


# --- Compare mode: delegate to shared compare-perf.js ---
if [ -n "$COMPARE_A" ]; then
  node "$SCRIPT_DIR/compare-perf.js" "$COMPARE_A" "$COMPARE_B"
  exit 0
fi

# --- Capture mode: run test and save baseline ---

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

echo "=== Maestro Performance Test ==="
echo "Simulator: $SIMULATOR"
echo "Flow: $FLOW"
echo "Runs: $NUM_RUNS"
echo ""

# Boot simulator
echo "Booting simulator..."
xcrun simctl boot "$SIMULATOR" 2>/dev/null || true

# Build app
if [ "$DO_BUILD" = true ]; then
  echo "Building app..."
  xcodebuild \
    -workspace "$SHARED_DIR/ios/Keybase.xcworkspace" \
    -scheme Keybase \
    -configuration Debug \
    -destination "platform=iOS Simulator,name=$SIMULATOR" \
    build 2>&1 | tail -5
  echo "Build complete."
else
  echo "Skipping build (pass --build to build first)"
fi

# Run N iterations, collecting profiler + FPS data from each
RUNS_DIR="$OUTPUT_DIR/runs"
rm -rf "$RUNS_DIR"
mkdir -p "$RUNS_DIR"

APP_CONTAINER=$(xcrun simctl get_app_container booted keybase.ios data 2>/dev/null || true)

for RUN_IDX in $(seq 1 "$NUM_RUNS"); do
  echo ""
  echo "--- Run $RUN_IDX of $NUM_RUNS ---"

  # Clear metro log for fresh profiler data
  echo "" > /tmp/metro.log

  # Kill the app cleanly before each run to avoid launch failures
  xcrun simctl terminate booted keybase.ios 2>/dev/null || true
  sleep 2

  if ! maestro test "$FLOW_PATH" 2>&1 | tee "$OUTPUT_DIR/maestro.log"; then
    echo "  (maestro run failed, skipping)"
    continue
  fi

  # Wait for console.log flush
  sleep 3

  RUN_DIR="$RUNS_DIR/run-$RUN_IDX"
  mkdir -p "$RUN_DIR"

  # Extract React Profiler data (last line = measurement phase, warmup was flushed first)
  PROFILER_LINE=$(grep -a 'PERF_REACT_PROFILER:' /tmp/metro.log | tail -1 || true)
  if [ -n "$PROFILER_LINE" ]; then
    PROFILER_JSON=$(echo "$PROFILER_LINE" | sed 's/.*PERF_REACT_PROFILER://')
    echo "$PROFILER_JSON" > "$RUN_DIR/react-profiler.json"
    DURATION=$(echo "$PROFILER_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin).get('totalDurationMs',0))" 2>/dev/null || echo "?")
    RENDERS=$(echo "$PROFILER_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin).get('totalRenders',0))" 2>/dev/null || echo "?")
    echo "  React: ${DURATION}ms / ${RENDERS} renders"
  else
    echo "  (no PERF_REACT_PROFILER data)"
  fi

  # Extract FPS data
  if [ -n "$APP_CONTAINER" ]; then
    FPS_FILE="$APP_CONTAINER/tmp/perf-fps.json"
    if [ -f "$FPS_FILE" ]; then
      cp "$FPS_FILE" "$RUN_DIR/maestro-fps.json"
      FPS_AVG=$(python3 -c "import json; print(json.load(open('$RUN_DIR/maestro-fps.json')).get('fps',{}).get('avg',0))" 2>/dev/null || echo "?")
      echo "  FPS avg: $FPS_AVG"
    else
      echo "  (no FPS data)"
    fi
  fi
done

# Pick median run by totalDurationMs
echo ""
echo "=== Selecting median run ==="
MEDIAN_NAME=$(python3 -c "
import json, os, sys

runs_dir = '$RUNS_DIR'
durations = []
for d in sorted(os.listdir(runs_dir)):
    rp = os.path.join(runs_dir, d, 'react-profiler.json')
    if os.path.exists(rp):
        with open(rp) as f:
            data = json.load(f)
        durations.append((data.get('totalDurationMs', 0), d))

if not durations:
    print('run-1')
    sys.exit(0)

durations.sort(key=lambda x: x[0])
# Print all runs to stderr (displayed to user)
for dur, name in durations:
    print(f'  {name}: {dur}ms', file=sys.stderr)

# Pick median
median_idx = len(durations) // 2
median_dur, median_name = durations[median_idx]
print(f'  Median: {median_name} ({median_dur}ms)', file=sys.stderr)
# Print just the name to stdout (captured by shell)
print(median_name)
")

# Copy median run to output
echo ""
echo "=== Results (median run: $MEDIAN_NAME) ==="

if [ -f "$RUNS_DIR/$MEDIAN_NAME/react-profiler.json" ]; then
  cp "$RUNS_DIR/$MEDIAN_NAME/react-profiler.json" "$OUTPUT_DIR/react-profiler.json"
  echo ""
  echo "React Profiler:"
  python3 -m json.tool "$OUTPUT_DIR/react-profiler.json" 2>/dev/null || cat "$OUTPUT_DIR/react-profiler.json"
fi

if [ -f "$RUNS_DIR/$MEDIAN_NAME/maestro-fps.json" ]; then
  cp "$RUNS_DIR/$MEDIAN_NAME/maestro-fps.json" "$OUTPUT_DIR/maestro-fps.json"
  echo ""
  echo "FPS:"
  python3 -m json.tool "$OUTPUT_DIR/maestro-fps.json" 2>/dev/null || cat "$OUTPUT_DIR/maestro-fps.json"
fi

# Save baseline with auto-increment
GIT_HASH=$(git -C "$SHARED_DIR" rev-parse --short HEAD)
BASELINE_DIR="$SCRIPT_DIR/baselines/$GIT_HASH"
if [ -d "$BASELINE_DIR" ]; then
  # Find next available increment
  N=1
  while [ -d "$SCRIPT_DIR/baselines/${GIT_HASH}-${N}" ]; do
    N=$((N + 1))
  done
  BASELINE_DIR="$SCRIPT_DIR/baselines/${GIT_HASH}-${N}"
fi
mkdir -p "$BASELINE_DIR"
for f in react-profiler.json maestro-fps.json; do
  if [ -f "$OUTPUT_DIR/$f" ]; then
    cp "$OUTPUT_DIR/$f" "$BASELINE_DIR/$f"
  fi
done

# Write unified perf.json (same format as desktop for compare-perf.js)
python3 -c "
import json, os
fps_file = '$BASELINE_DIR/maestro-fps.json'
react_file = '$BASELINE_DIR/react-profiler.json'
fps_raw = json.load(open(fps_file)) if os.path.exists(fps_file) else {}
react = json.load(open(react_file)) if os.path.exists(react_file) else None
fps = fps_raw.get('fps', fps_raw)
duration_s = fps_raw.get('durationSeconds', 0)
perf = {
    'durationMs': duration_s * 1000,
    'fps': fps,
    'longTasks': None,
    'memory': None,
    'react': react,
}
json.dump(perf, open('$BASELINE_DIR/perf.json', 'w'), indent=2)
"

# Write metadata
python3 -c "
import json, datetime
meta = {
    'version': 2,
    'date': datetime.datetime.now().isoformat(),
    'flow': '$FLOW',
    'numRuns': $NUM_RUNS,
    'medianRun': '$MEDIAN_NAME',
    'simulator': '$SIMULATOR',
    'gitHash': '$(git -C "$SHARED_DIR" rev-parse --short HEAD)',
    'gitBranch': '$(git -C "$SHARED_DIR" rev-parse --abbrev-ref HEAD)',
    'notes': 'v2: 3+3 swipes, median of N runs'
}
with open('$BASELINE_DIR/meta.json', 'w') as f:
    json.dump(meta, f, indent=2)
print(json.dumps(meta, indent=2))
"
echo ""
echo "=== Baseline saved to $(basename "$BASELINE_DIR")/ ==="
ls "$BASELINE_DIR/"

echo ""
echo "=== Done ==="
echo "Output: $OUTPUT_DIR/"
