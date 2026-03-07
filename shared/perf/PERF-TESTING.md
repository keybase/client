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
# Quick run (default — skips build, 3 runs, picks median). Use this for JS-only changes.
cd shared && yarn maestro-test-perf

# Single run (faster, less accurate)
cd shared && yarn maestro-test-perf --runs 1

# Full run (builds the app first). Only needed when native code changes
# (e.g. files in ios/, android/, rnmodules/, go/bind/).
cd shared && yarn maestro-test-perf --build

# Run teams scroll perf test
cd shared && yarn maestro-test-perf-teams

# Run any Maestro flow
cd shared && yarn maestro-test --flow performance/perf-inbox-scroll.yaml

# Custom simulator
cd shared && yarn maestro-test-perf --simulator "iPhone 16 Pro"
```

### Available Flows

| Flow | What it measures |
|------|-----------------|
| `performance/perf-inbox-scroll.yaml` | Launch → navigate to Chat → 3 swipes up + 3 swipes down on inbox list |
| `performance/perf-teams-scroll.yaml` | Launch → navigate to Teams → 3 swipes up + 3 swipes down on teams list |

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
| `TeamsList` | `teams/main/index.tsx` | Full teams list container |
| `TeamRow` | `teams/main/index.tsx` | Each team row |

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
| `teamsList` | Teams list (LegendList via Kb.List) |

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

Shared subflows live in `shared/.maestro/subflows/` (e.g. `navigate-to-chat.yaml`).

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

## Baselines & Comparison

The `baselines/` folder (gitignored) stores snapshots of perf results keyed by git commit hash, enabling before/after comparisons across branches.

### Automatic Baseline Saving

Every test run automatically saves results to `shared/perf/baselines/<short-git-hash>/`. If a baseline for that hash already exists, it auto-increments (e.g. `abc1234-1`, `abc1234-2`).

By default, 3 runs are performed and the median (by `totalDurationMs`) is saved. Use `--runs 1` for quick single-run captures.

```bash
# Run the test — baseline is saved automatically (3 runs, median)
cd shared && yarn maestro-test-perf
```

Output includes:
```
--- Run 1 of 3 ---
  React: 2100ms / 420 renders
--- Run 2 of 3 ---
  React: 2050ms / 415 renders
--- Run 3 of 3 ---
  React: 2200ms / 425 renders

=== Selecting median run ===
  Median: run-2 (2050ms)

=== Baseline saved to abc1234/ ===
react-profiler.json  maestro-fps.json
```

### Comparing Against a Baseline

```bash
# Compare current run against a saved baseline
cd shared && yarn maestro-test-perf --compare baselines/<hash>
```

Output:
```
=== Comparison vs baseline abc1234 ===
FPS  avg:  56 -> 62  (+10.7%)
FPS   p5:  40 -> 48  (+20.0%)
React totalDurationMs: 5192 -> 3800  (-26.8%)
React totalRenders: 758 -> 520  (-31.4%)

Component                   old ms   new ms   change   old #  new #
--------------------------------------------------------------------------------
Inbox                         3374     2100     -38%     308    200
InboxRow-big                  1338      900     -33%     362    210
```

### Recommended Workflow

1. Check out the **base branch** and run a test (use `--build` only if native code changed):
   ```bash
   git checkout nojima/HOTPOT-next-670-clean
   cd shared && yarn maestro-test-perf          # JS-only changes
   cd shared && yarn maestro-test-perf --build   # native code changes
   ```
   Note the saved baseline hash from the output.
2. Switch to the **feature branch**:
   ```bash
   git checkout nojima/HOTPOT-inbox-clean-1
   ```
3. Run with comparison against the saved baseline:
   ```bash
   cd shared && yarn maestro-test-perf --compare baselines/<base-hash>
   ```
4. Review the side-by-side output. Negative percentages for React metrics and positive for FPS indicate improvement.

## Visual Regression Testing (Desktop Screenshots)

Pixel-level comparison of all 8 desktop app tabs between branches to catch visual regressions (color changes, layout shifts, sizing issues).

### Prerequisites

- App running with remote debugging: `KB_ENABLE_REMOTE_DEBUG=1 yarn start-hot`
- ImageMagick installed: `brew install imagemagick`

### Workflow

#### Option A: Automated scripts

```bash
# 1. Check out base branch, start app, take baseline screenshots
git checkout nojima/HOTPOT-next-670-clean
# (start app with KB_ENABLE_REMOTE_DEBUG=1 yarn start-hot)
cd shared && node perf/visual-diff-take.js baseline

# 2. Check out feature branch, rebuild, take current screenshots
git checkout my-feature-branch
# (restart app)
cd shared && node perf/visual-diff-take.js current

# 3. Compare
cd shared && ./perf/visual-diff-compare.sh
```

#### Option B: Using Playwright MCP + Claude

1. Start the app: `KB_ENABLE_REMOTE_DEBUG=1 yarn start-hot`
2. In Claude, close DevTools tab and select the app tab
3. Navigate to each tab and take screenshots:
   - Save baseline set to `/tmp/visual-diff/baseline/`
   - Save current set to `/tmp/visual-diff/current/`
4. Run comparison: `./perf/visual-diff-compare.sh`

### Reading Diff Images

The diff images show red pixels where the two screenshots differ. Open them to evaluate:

- **Subpixel noise** (<200px): Scattered faint red dots from font antialiasing — safe to ignore.
- **Dynamic content**: Avatars, timestamps, badges, and team data change between runs — safe to ignore.
- **COLOR REGRESSION**: Entire icons or text areas are solid red. This means colors changed (e.g. an icon went from blue to gray). Investigate the component.
- **SIZE/POSITION REGRESSION**: Red outlines or doubled shapes around elements. Something shifted position or changed size. Common cause: `Box2` adding `alignSelf: 'center'` where the old code used a plain `<div>`.
- **Rule of thumb**: If the text labels are clean but nearby icons are fully red, it's a real color or position bug, not noise.

### Output

All screenshots go to `/tmp/visual-diff/` (outside the repo):

| Directory | Contents |
|-----------|----------|
| `baseline/` | Base branch screenshots (8 PNGs, one per tab) |
| `current/` | Feature branch screenshots |
| `diff/` | ImageMagick diff images (red = different pixels) |

Tabs captured: People, Chat, Files, Crypto, Teams, Git, Devices, Settings.

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
