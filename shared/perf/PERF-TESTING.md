# Performance Testing

Tools and workflows for measuring scroll performance in the Keybase app, covering both the desktop Electron app (via Playwright MCP + CDP) and the iOS simulator (via XCUITest).

## Desktop Performance Profiling

### Prerequisites

- App running with remote debugging: `KB_ENABLE_REMOTE_DEBUG=1 yarn start-hot`
- Playwright MCP configured to connect via CDP on port 9222

### Quick Workflow (Playwright MCP + Claude)

1. Start the app: `KB_ENABLE_REMOTE_DEBUG=1 yarn start-hot`
2. In Claude, close the DevTools tab (`browser_tabs` action=close index=0) and select the app tab
3. Navigate to the target page via snapshot + click
4. Read and inject the perf measurement script:
   ```
   browser_evaluate: (paste contents of desktop-perf-inject.js)
   ```
5. Start measurement:
   ```
   browser_evaluate: window.__perf.start()
   ```
6. Scroll using `browser_press_key` (PageDown x20, PageUp x20) or call:
   ```
   browser_evaluate: window.__perf.scrollContainer('[data-testid="message-list"]', {distance: 3000})
   ```
7. Stop and get results:
   ```
   browser_evaluate: JSON.stringify(window.__perf.stop())
   ```

### Available Test IDs

| Selector | Component |
|----------|-----------|
| `[data-testid="message-list"]` | Chat message list scroll container |
| `[data-testid="inbox-list"]` | Inbox/conversation list scroll container |

### Metrics Returned

```js
{
  durationMs: number,          // Total measurement time
  fps: {
    avg: number,               // Average frames per second
    min: number,               // Lowest 1-second FPS sample
    max: number,               // Highest 1-second FPS sample
    p5: number,                // 5th percentile (worst-case)
    samples: number[]          // Per-second FPS values
  },
  longTasks: {
    count: number,             // Tasks >50ms
    totalMs: number,           // Sum of all long task durations
    entries: Array<{duration, startTime}>
  },
  memory: {
    startHeapMB: number,
    endHeapMB: number,
    peakHeapMB: number
  },
  marks: Array<{name, startTime}>  // Any performance.mark() calls
}
```

### CPU Profiling (CDP)

For deeper analysis, capture a CPU profile:

```bash
node shared/perf/run-desktop-cdp-profile.js --duration 5000
```

This saves a `.cpuprofile` file to `shared/perf/output/` that can be loaded in Chrome DevTools (Performance tab > Load profile).

Options:
- `--duration <ms>` — Recording duration (default: 5000)
- `--output <path>` — Output file path

## iOS Performance Profiling

### Prerequisites

- Xcode with the Keybase workspace
- iOS Simulator running (or specify a simulator name)
- The KeybaseUITests target built into the project

### Test IDs

| testID | Component |
|--------|-----------|
| `messageList` | Chat message list (FlatList) |
| `inboxList` | Inbox conversation list (FlatList) |

### Running Tests

```bash
# Run all scroll performance tests
./shared/perf/run-ios-perf.sh

# Run a specific test
./shared/perf/run-ios-perf.sh --test testInboxScrollPerformance

# Run with xctrace recording
./shared/perf/run-ios-perf.sh --trace

# Specify simulator
./shared/perf/run-ios-perf.sh --simulator "iPhone 15 Pro"
```

### Available Tests

| Test | What it measures |
|------|-----------------|
| `testInboxScrollPerformance` | Single swipe up/down on inbox list |
| `testMessageListScrollPerformance` | Single swipe up/down on message list |
| `testRapidScrollPerformance` | 10 rapid swipes each direction on messages |

### Parsing Results

```bash
node shared/perf/parse-ios-results.js
# or specify a custom path:
node shared/perf/parse-ios-results.js shared/perf/output/ios-results.json
```

### Output Files

All output goes to `shared/perf/output/` (gitignored):
- `ios-result.xcresult` — Xcode result bundle
- `ios-results.json` — Parsed xcresult JSON
- `ios-test.log` — Build/test console output
- `ios-trace.trace` — xctrace recording (if `--trace` used)

## Interpreting Results

### Before/After Comparison

When measuring the impact of a change:

1. Run the test on the base branch, note metrics
2. Apply your change
3. Run the same test again
4. Compare:
   - **FPS**: Higher is better. p5 (5th percentile) is the most useful — it captures worst-case jank
   - **Long tasks**: Fewer and shorter is better. Any task >100ms causes visible jank
   - **Memory**: Check for leaks (endHeapMB >> startHeapMB after repeated scroll cycles)
   - **Clock time** (iOS): Lower is better for the same scroll distance

### What's "Good"?

- **Desktop FPS**: 55+ avg is good, <30 p5 indicates jank
- **Long tasks**: 0 is ideal; >5 during a scroll is concerning
- **iOS scroll deceleration**: XCTest baseline comparison handles this — focus on regressions
