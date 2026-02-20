# Performance Testing

Tools and workflows for measuring scroll performance in the Keybase app, covering both the desktop Electron app (via Playwright MCP + CDP) and the iOS simulator (via XCUITest + CADisplayLink FPS monitor).

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

### Desktop Test IDs

| Selector | Component |
|----------|-----------|
| `[data-testid="message-list"]` | Chat message list scroll container |
| `[data-testid="inbox-list"]` | Inbox/conversation list (note: testid is on wrapper div; the scrollable element is its first child) |

### Desktop Metrics Returned

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
- iOS Simulator booted (use a device compatible with your Xcode SDK, e.g. iPhone 17 Pro for Xcode 26)
- Metro dev server running (`yarn react-native start`) — the first bundle takes ~30s; subsequent runs use cache
- The app must be logged in on the simulator (provision manually before first test run)

### How It Works

The iOS perf tests use two complementary systems:

1. **XCUITest (`ScrollPerformanceTests.swift`)** — Automates the UI: launches the app, navigates to chat, scrolls lists up and down, and times the operations with `CFAbsoluteTimeGetCurrent()`.

2. **PerfFPSMonitor (`PerfFPSMonitor.swift`)** — A native `CADisplayLink`-based FPS monitor that runs inside the app process. Activated by the `-PERF_FPS_MONITOR` launch argument (passed automatically by the tests). Counts frames per second during the entire test session and writes results to the app's tmp directory as JSON when the app backgrounds.

The flow:
- XCUITest launches the app with `-PERF_FPS_MONITOR`
- `AppDelegate` calls `PerfFPSMonitor.startIfEnabled()` on launch
- The CADisplayLink fires on `.common` run loop mode (works during scroll tracking)
- Per-second frame counts are accumulated as samples
- In `tearDown`, the test presses Home → `applicationDidEnterBackground` triggers `PerfFPSMonitor.stop()` → JSON is written
- The shell script extracts the JSON from the simulator's app container via `xcrun simctl get_app_container`

### iOS Test IDs

| testID | Component |
|--------|-----------|
| `messageList` | Chat message list (FlatList) |
| `inboxList` | Inbox conversation list (FlatList) |

These are set via `testID` prop on the React Native FlatList components, which maps to `accessibilityIdentifier` for XCUITest discovery.

### Running Tests

```bash
# Run all scroll performance tests
./shared/perf/run-ios-perf.sh --simulator "iPhone 17 Pro"

# Run a specific test
./shared/perf/run-ios-perf.sh --simulator "iPhone 17 Pro" --test testInboxScrollPerformance

# Run with xctrace recording
./shared/perf/run-ios-perf.sh --simulator "iPhone 17 Pro" --trace
```

### Available Tests

| Test | What it measures |
|------|-----------------|
| `testInboxScrollPerformance` | 5 fast swipes up + 5 fast swipes down on inbox list |
| `testMessageListScrollPerformance` | Opens first conversation, 5 fast swipes down (into history, list is inverted) + 5 back up |

### iOS FPS Metrics

The FPS JSON written by `PerfFPSMonitor` and extracted by the shell script:

```json
{
  "durationSeconds": 43,
  "fps": {
    "avg": 51.7,
    "min": 6,
    "max": 60,
    "p5": 32,
    "samples": [46, 12, 59, 60, ...]
  }
}
```

- **avg** — Average FPS across all 1-second samples (includes app launch/navigation, not just scrolling)
- **min** — Lowest single-second sample (often during transitions, not scroll jank)
- **max** — Highest single-second sample (60 = vsync ceiling on standard displays)
- **p5** — 5th percentile: the FPS at the worst 5% of seconds
- **samples** — Raw per-second frame counts for the entire test duration

### Output Files

All output goes to `shared/perf/output/` (gitignored):

| File | Content |
|------|---------|
| `ios-result.xcresult` | Xcode result bundle |
| `ios-summary.json` | Test pass/fail summary from xcresulttool |
| `ios-metrics.json` | Test metrics from xcresulttool |
| `ios-fps.json` | FPS data from PerfFPSMonitor (extracted from app container) |
| `ios-test.log` | Full xcodebuild console output |
| `ios-trace.trace` | xctrace recording (if `--trace` used) |

### Parsing Results

```bash
node shared/perf/parse-ios-results.js
```

### Gotchas

- **First run after Metro restart**: The initial JS bundle takes ~30-60s. The test setUp has a 60-second timeout for the Chat tab to appear, but if bundling is very slow it can still time out. Run once manually to warm the cache.
- **App state persistence**: The app saves navigation state between launches. The test setUp handles this by checking for the inbox and pressing Back if inside a conversation.
- **Inverted message list**: The chat message list is inverted (newest at bottom). Swipe **down** scrolls into history, swipe **up** returns to recent messages.
- **Tab bar accessibility**: On phones (not tablets), tab bar items show only icons. The `tabBarAccessibilityLabel` prop in `router.native.tsx` provides the "Chat" label for XCUITest discovery.
- **FlatList rows aren't UITableViewCells**: React Native FlatList items aren't native cells, so `app.cells` won't find them. Use coordinate-based taps instead (e.g. `inbox.coordinate(withNormalizedOffset:)`).
- **NSLog from test methods**: `NSLog` calls in the XCUITest Swift code don't appear in xcodebuild stdout — they go to the xcresult activity log. Use file-based extraction (like PerfFPSMonitor) for reliable data retrieval.

## Interpreting Results

### Before/After Comparison

When measuring the impact of a change:

1. Run the test on the base branch, note metrics
2. Apply your change
3. Run the same test again
4. Compare:
   - **FPS**: Higher is better. p5 (5th percentile) is the most useful — it captures worst-case jank
   - **Long tasks** (desktop): Fewer and shorter is better. Any task >100ms causes visible jank
   - **Memory** (desktop): Check for leaks (endHeapMB >> startHeapMB after repeated scroll cycles)

### What's "Good"?

- **Desktop FPS**: 55+ avg is good, <30 p5 indicates jank
- **Desktop long tasks**: 0 is ideal; >5 during a scroll is concerning
- **iOS FPS**: 50+ avg is good for simulator (real devices perform differently). p5 > 30 means scrolling is smooth. Dips during app launch and navigation transitions are normal and expected.
