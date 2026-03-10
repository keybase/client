---
name: visual-diff
description: This skill should be used when the user asks to "compare screenshots", "visual diff", "check for visual regressions", "before and after screenshots", "did the UI change", or mentions comparing the app UI between branches or before/after a change. Also triggered by "take baseline", "take current", or "compare against baseline".
---

Run a visual regression test by capturing baseline and current screenshots of the app, then comparing them with ImageMagick to find pixel-level differences.

## Determine Platform

Ask the user which platform to test if unclear: **desktop** (Electron via Playwright MCP) or **iOS** (simulator via Maestro). If context makes it obvious (e.g. they're working on iOS code), skip asking.

## Desktop Workflow

### Prerequisites
- App running with `KB_ENABLE_REMOTE_DEBUG=1 yarn start-hot`
- ImageMagick installed (`brew install imagemagick`)

### Option A: Automated Scripts (preferred)
```bash
# Baseline (on base branch, app running)
cd shared && node perf/visual-diff-take.js baseline

# Current (on feature branch, app restarted)
cd shared && node perf/visual-diff-take.js current

# Compare
cd shared && ./perf/visual-diff-compare.sh
```

### Option B: Playwright MCP (manual)
1. Close the DevTools tab (`browser_tabs` action=close index=0), select the app tab.
2. Navigate to each tab (People, Chat, Files, Crypto, Teams, Git, Devices, Settings) via `browser_snapshot` + `browser_click`.
3. Take screenshots to `/tmp/visual-diff/baseline/` or `/tmp/visual-diff/current/`.
4. Run `cd shared && ./perf/visual-diff-compare.sh`.

## iOS Workflow

### Prerequisites
- iOS Simulator booted with app running and logged in
- Maestro installed
- ImageMagick installed

### Steps
```bash
# Baseline (on base branch)
cd shared && ./perf/visual-diff-take-ios.sh baseline

# Current (on feature branch)
cd shared && ./perf/visual-diff-take-ios.sh current

# Compare
cd shared && ./perf/visual-diff-compare-ios.sh
```

Screenshots go to `/tmp/visual-diff-ios/{baseline,current,diff}/`.

## Viewing Results

After comparison, read the diff images to evaluate:

1. Resize each diff image for token efficiency:
   ```
   sips -Z 800 /tmp/visual-diff/diff/<tab>.png --out /tmp/visual-diff-resized/<tab>.png
   ```
   (Use `/tmp/visual-diff-ios/diff/` for iOS.)

2. Use the Read tool to display each resized diff image.

## Interpreting Diffs

Red pixels indicate differences between baseline and current screenshots.

- **Subpixel noise** (<200px desktop, <500px iOS): Scattered faint red dots from font antialiasing. Safe to ignore.
- **Dynamic content**: Avatars, timestamps, badges change between runs. Safe to ignore.
- **COLOR REGRESSION**: Entire icons or text areas are solid red — colors changed (e.g. icon went blue → gray). Investigate.
- **SIZE/POSITION REGRESSION**: Red outlines or doubled shapes — something shifted. Common cause: `Box2` adding `alignSelf: 'center'` where old code used `<div>`.
- **Rule of thumb**: Clean text labels + solid red icons = real bug, not noise.

## Typical Session

1. User says "take baseline" → run the baseline capture step.
2. User makes code changes and restarts app.
3. User says "compare" or "take current" → run the current capture + comparison.
4. Display diff images and summarize findings: which tabs changed, whether changes look intentional or are regressions.
