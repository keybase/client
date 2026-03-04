# Performance Testing

Tools and workflows for measuring performance in the Keybase app, covering the desktop Electron app (via Playwright MCP + CDP) and iOS simulator (via Maestro + React Profiler + native FPS monitor).

## iOS Performance Profiling (Maestro)

### Prerequisites

1. Install Maestro: `curl -Ls "https://get.maestro.mobile.dev" | bash`
2. iOS Simulator booted (e.g. iPhone 17 Pro)
3. Metro running with debug logging: `cd shared && yarn rn-start-debug`
4. App built and installed on the simulator
5. App must be logged in (provision manually before first test run)

### How It Works

Maestro drives the UI while two systems collect performance data:

1. **React `<Profiler>` wrappers (`perf/react-profiler.tsx`)** — In `__DEV__`, wraps key components in `<React.Profiler>` to collect per-component render counts and durations. On app background (Home press), aggregates and logs data as `PERF_REACT_PROFILER:{json}` to console → Metro log.

2. **PerfFPSMonitor (`ios/Keybase/PerfFPSMonitor.swift`)** — Native `CADisplayLink`-based FPS monitor. Activated by the `PERF_FPS_MONITOR` launch argument (passed by Maestro flows). Counts frames per second and writes JSON to the app's tmp directory when the app backgrounds.

The flow:
- Maestro launches the app with `PERF_FPS_MONITOR: "true"`
- `AppDelegate` calls `PerfFPSMonitor.startIfEnabled()` on launch
- Maestro navigates and scrolls as defined in the YAML flow
- Maestro presses Home → triggers both React Profiler flush (via AppState) and FPS monitor write
- `run-maestro.sh` extracts both from Metro log and simulator app container

### Running Tests

```bash
# Quick run (skip build if app is already installed)
cd shared && yarn maestro-test-perf --skip-build

# Full run (builds the app first)
cd shared && yarn maestro-test-perf

# Run any Maestro flow
cd shared && yarn maestro-test --flow performance/perf-inbox-scroll.yaml --skip-build

# Custom simulator
cd shared && yarn maestro-test-perf --skip-build --simulator "iPhone 16 Pro"
```

### Available Flows

| Flow | What it measures |
|------|-----------------|
| `performance/perf-inbox-scroll.yaml` | Launch → navigate to Chat → 5 fast swipes up + 5 fast swipes down on inbox list |

### React Profiler Wrappers

Components currently wrapped with `<PerfProfiler>`:

| ID | Location | What it covers |
|----|----------|---------------|
| `Inbox` | `chat/inbox/index.native.tsx` | Full inbox container |
| `InboxRow-{type}` | `chat/inbox/index.native.tsx` | Each inbox row (small, big, bigHeader, divider, teamBuilder) |
| `Conversation` | `chat/conversation/normal/index.native.tsx` | Full conversation screen |
| `MessageList` | `chat/conversation/list-area/index.native.tsx` | Message list FlatList container |
| `Msg-{type}` | `chat/conversation/list-area/index.native.tsx` | Each message (text, attachment, system*, etc.) |
| `ChatInput` | `chat/conversation/input-area/container.tsx` | Chat input area |

To add more wrappers, import `{PerfProfiler}` from `@/perf/react-profiler` and wrap the component. In production builds, `PerfProfiler` is a no-op passthrough.

### React Profiler Output

```json
{
  "components": {
    "Inbox": {"mountCount": 1, "updateCount": 307, "totalMs": 3374, "avgMs": 11.0, "maxMs": 291},
    "InboxRow-big": {"mountCount": 263, "updateCount": 99, "totalMs": 1338, "avgMs": 3.7, "maxMs": 13}
  },
  "totalRenders": 758,
  "totalDurationMs": 5192
}
```

### FPS Output

```json
{
  "durationSeconds": 49,
  "fps": {
    "avg": 56,
    "min": 32,
    "max": 60,
    "p5": 40,
    "samples": [46, 56, 60, 57, ...]
  }
}
```

- **avg** — Average FPS across all 1-second samples (includes app launch/navigation)
- **min** — Lowest single-second sample
- **max** — Highest (60 = vsync ceiling)
- **p5** — 5th percentile: worst-case FPS
- **samples** — Raw per-second frame counts

### iOS Test IDs

| testID | Component |
|--------|-----------|
| `inboxList` | Inbox conversation list (FlatList) |
| `messageList` | Chat message list (FlatList) |

Set via `testID` prop on React Native FlatList, maps to `accessibilityIdentifier` for Maestro.

### Output Files

All output goes to `shared/perf/output/` (gitignored):

| File | Content |
|------|---------|
| `react-profiler.json` | React Profiler aggregated data |
| `maestro-fps.json` | FPS data from PerfFPSMonitor |
| `maestro.log` | Maestro test console output |

### Adding New Flows

Create a YAML file in `shared/.maestro/performance/`. Example structure:

```yaml
appId: keybase.ios

---

- launchApp:
    stopApp: true
    arguments:
      PERF_FPS_MONITOR: "true"

- extendedWaitUntil:
    visible:
      text: "Chat"
    timeout: 60000

- runFlow: ../shared/navigate-to-chat.yaml

# Your test actions here (swipe, tap, etc.)

# Press Home to flush profiler + FPS data
- pressKey: Home
```

Shared subflows live in `shared/.maestro/shared/` (e.g. `navigate-to-chat.yaml`).

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
| `[data-testid="inbox-list"]` | Inbox/conversation list |

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

## Interpreting Results

### Before/After Comparison

1. Run the test on the base branch, note metrics
2. Apply your change
3. Run the same test again
4. Compare:
   - **FPS**: Higher is better. p5 (5th percentile) captures worst-case jank
   - **React Profiler**: Compare render counts and total ms per component
   - **Long tasks** (desktop): Fewer and shorter is better. Any task >100ms causes visible jank
   - **Memory** (desktop): Check for leaks (endHeapMB >> startHeapMB after repeated scroll cycles)

### What's "Good"?

- **Desktop FPS**: 55+ avg is good, <30 p5 indicates jank
- **Desktop long tasks**: 0 is ideal; >5 during a scroll is concerning
- **iOS FPS**: 50+ avg is good for simulator (real devices perform differently). p5 > 30 means smooth scrolling. Dips during app launch and navigation transitions are normal.
