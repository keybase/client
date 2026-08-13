# Performance Testing

Tools and workflows for measuring performance in the desktop Electron app (via Playwright MCP + CDP).

## Chat Thread Regression Checklist

Use this alongside automated thread perf runs when changing `chat/conversation/list-area/*` or row rendering:

1. Open an existing conversation with no centered target and confirm it lands at the latest message without drifting after load.
2. Scroll upward until older messages paginate in and confirm the visible anchor does not jump.
3. While pinned to bottom, send or receive a message and confirm the list remains pinned to the latest row.
4. Let a pending/placeholder message resolve and confirm it swaps in place without reuse glitches.
5. Add/remove a reaction and open edit mode on a message, then confirm the correct row updates and desktop scrolls to the editing message.
6. Trigger a centered jump from thread search and confirm the target row is centered/highlighted without breaking later scrolling.

## Desktop Performance Profiling

### Prerequisites

- App running with remote debugging: `yarn desktop:start:hot:debug`
- `playwright-core` installed globally: `yarn global add playwright-core`

React render counts come from `<PerfProfiler>` wrappers (`perf/react-profiler.tsx`) around `Inbox`, `ConversationList`, `MessageWrapper`, `Conversation`, `InputArea`, and `Teams`; `run-desktop-perf.js` reads their aggregated data.

### Automated Thread Scroll Test

Navigates to chat, opens the first conversation, scrolls the message list, and reports FPS + long task metrics.

```bash
# Capture (default 3 runs, picks median, saves baseline automatically)
cd shared && yarn perf:thread:desktop

# Single run (faster)
cd shared && yarn perf:thread:desktop --runs 1

# Skip auto-navigation (if you already have a thread open)
cd shared && yarn perf:thread:desktop --no-navigate

# Compare two saved baselines (no app connection needed)
cd shared && yarn perf:compare <hash-a> <hash-b>
```

Baselines are saved to `shared/perf/baselines/<short-git-hash>/` (gitignored):
- `perf.json` — median run data (FPS, long tasks, memory, React renders)
- `meta.json` — date, git hash, branch, flow, run count

### Recommended Workflow

1. Check out the base branch, run capture:
   ```bash
   git checkout master
   cd shared && yarn perf:thread:desktop
   ```
   Note the saved baseline hash from the output.
2. Switch to your feature branch, run capture again:
   ```bash
   git checkout my-feature-branch
   cd shared && yarn perf:thread:desktop
   ```
3. Compare:
   ```bash
   cd shared && yarn perf:compare <base-hash> <feature-hash>
   ```

Comparison output:
```
=== Comparison: abc1234 vs def5678 ===
Metric        abc1234   def5678   Change
------------  --------  --------  ------
FPS avg       52        58        +11.5%
FPS p5        38        48        +26.3%
FPS min       30        38        +26.7%
Long tasks    5         2         -60.0%
Long task ms  340       130       -61.8%
Memory start  210MB     210MB
Memory peak   225MB     218MB
Memory end    215MB     212MB
```

### Manual Workflow (Playwright MCP + Claude)

1. Start the app: `yarn desktop:start:hot:debug` (requires Playwright MCP configured)
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
   browser_evaluate: window.__perf.scrollContainer('[data-testid="chat-message-list"]', {distance: 3000})
   ```
7. Stop and get results:
   ```
   browser_evaluate: JSON.stringify(window.__perf.stop())
   ```

### Desktop Test IDs

| Selector | Component |
|----------|-----------|
| `[data-testid="chat-message-list"]` | Chat message list scroll container |
| `[data-testid="chat-inbox-list"]` | Inbox/conversation list |

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
cd shared && yarn perf:thread:desktop
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
desktop-fps.json
```

### Comparing Against a Baseline

```bash
# Compare current run against a saved baseline
cd shared && yarn perf:thread:desktop --compare baselines/<hash>
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

1. Check out the **base branch** and run a test:
   ```bash
   git checkout nojima/HOTPOT-next-670-clean
   cd shared && yarn perf:thread:desktop
   ```
   Note the saved baseline hash from the output.
2. Switch to the **feature branch**:
   ```bash
   git checkout nojima/HOTPOT-inbox-clean-1
   ```
3. Run with comparison against the saved baseline:
   ```bash
   cd shared && yarn perf:thread:desktop --compare baselines/<base-hash>
   ```
4. Review the side-by-side output. Negative percentages for React metrics and positive for FPS indicate improvement.

## Visual Regression Testing (Desktop Screenshots)

Pixel-level comparison of all 8 desktop app tabs between branches to catch visual regressions (color changes, layout shifts, sizing issues).

### Prerequisites

- App running with remote debugging: `yarn desktop:start:hot:debug`
- ImageMagick installed: `brew install imagemagick`

### Workflow

#### Option A: Automated scripts

```bash
# 1. Check out base branch, start app, take baseline screenshots
git checkout nojima/HOTPOT-next-670-clean
# (start app with yarn desktop:start:hot:debug)
cd shared && node perf/visual-diff-take.js baseline

# 2. Check out feature branch, rebuild, take current screenshots
git checkout my-feature-branch
# (restart app)
cd shared && node perf/visual-diff-take.js current

# 3. Compare
cd shared && ./perf/visual-diff-compare.sh
```

#### Option B: Using Playwright MCP + Claude

1. Start the app: `yarn desktop:start:hot:debug`
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
