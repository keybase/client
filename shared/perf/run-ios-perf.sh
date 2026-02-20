#!/bin/bash
# iOS performance test runner using XCUITest.
#
# Usage: ./run-ios-perf.sh [--trace] [--test testName] [--simulator "name"]
#
# Options:
#   --trace        Also record an xctrace alongside XCUITest
#   --test NAME    Run specific test method (default: all in ScrollPerformanceTests)
#   --simulator    Simulator name (default: "iPhone 16")

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
IOS_DIR="$(cd "$SCRIPT_DIR/../ios" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/output"
mkdir -p "$OUTPUT_DIR"

TRACE=false
TEST_NAME=""
SIMULATOR="iPhone 16"

while [[ $# -gt 0 ]]; do
  case $1 in
    --trace) TRACE=true; shift ;;
    --test) TEST_NAME="$2"; shift 2 ;;
    --simulator) SIMULATOR="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

ONLY_TESTING=""
if [ -n "$TEST_NAME" ]; then
  ONLY_TESTING="-only-testing:KeybaseUITests/ScrollPerformanceTests/$TEST_NAME"
fi

RESULT_BUNDLE="$OUTPUT_DIR/ios-result.xcresult"
LOG_FILE="$OUTPUT_DIR/ios-test.log"

# Clean previous result bundle
rm -rf "$RESULT_BUNDLE"

TRACE_PID=""
TRACE_FILE="$OUTPUT_DIR/ios-trace.trace"

if [ "$TRACE" = true ]; then
  echo "Starting xctrace recording..."
  rm -rf "$TRACE_FILE"
  xctrace record \
    --device-name "$SIMULATOR" \
    --template 'Time Profiler' \
    --output "$TRACE_FILE" \
    --time-limit 120s &
  TRACE_PID=$!
  sleep 2
fi

echo "Building and running XCUITests..."
echo "Simulator: $SIMULATOR"

xcodebuild test \
  -workspace "$IOS_DIR/Keybase.xcworkspace" \
  -scheme Keybase \
  -destination "platform=iOS Simulator,name=$SIMULATOR" \
  $ONLY_TESTING \
  -resultBundlePath "$RESULT_BUNDLE" \
  2>&1 | tee "$LOG_FILE" || true

if [ -n "$TRACE_PID" ] && kill -0 "$TRACE_PID" 2>/dev/null; then
  echo "Stopping xctrace..."
  kill "$TRACE_PID" 2>/dev/null || true
  wait "$TRACE_PID" 2>/dev/null || true
fi

# Extract results from xcresult bundle
if [ -d "$RESULT_BUNDLE" ]; then
  echo ""
  echo "=== Extracting results ==="
  xcrun xcresulttool get test-results summary \
    --path "$RESULT_BUNDLE" \
    > "$OUTPUT_DIR/ios-summary.json" 2>/dev/null || true

  xcrun xcresulttool get test-results metrics \
    --path "$RESULT_BUNDLE" \
    > "$OUTPUT_DIR/ios-metrics.json" 2>/dev/null || true

  echo "Results saved to:"
  echo "  xcresult:  $RESULT_BUNDLE"
  echo "  Summary:   $OUTPUT_DIR/ios-summary.json"
  echo "  Metrics:   $OUTPUT_DIR/ios-metrics.json"
  echo "  Log:       $LOG_FILE"

  if [ "$TRACE" = true ] && [ -d "$TRACE_FILE" ]; then
    echo "  Trace:     $TRACE_FILE"
  fi

  echo ""
  echo "Parse results with: node $SCRIPT_DIR/parse-ios-results.js"
else
  echo ""
  echo "No xcresult bundle produced. Check $LOG_FILE for errors."
fi
