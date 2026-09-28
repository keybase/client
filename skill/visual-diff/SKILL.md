---
name: visual-diff
description: This skill should be used when the user asks to "compare screenshots", "visual diff", "check for visual regressions", "before and after screenshots", "did the UI change", or mentions comparing the desktop app UI between branches or before/after a change. Also triggered by "take baseline", "take current", or "compare against baseline".
---

Run a visual regression test by capturing baseline and current screenshots of the app, then comparing them with ImageMagick to find pixel-level differences.

## Workflow

### Prerequisites
- App running with `KB_ENABLE_REMOTE_DEBUG=1 yarn desktop:start:hot`
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

### Option B: playwright-cli (manual)
1. Attach and select the main app tab as described in the playwright-cli skill ("Connecting to the Electron App"): `PLAYWRIGHT_MCP_CDP_ENDPOINT=http://localhost:9222 playwright-cli open --persistent`, then `tab-list` and `tab-select` the row whose URL contains `main.html`.
2. Navigate to each tab (People, Chat, Files, Crypto, Teams, Git, Devices, Settings) with `playwright-cli click` or `eval`. `snapshot` reads the first CDP page (usually the menubar), not the selected tab, so locate elements with `eval`.
3. Save each with `playwright-cli screenshot --filename=/tmp/visual-diff/<baseline|current>/<tab>.png`.
4. Run `cd shared && ./perf/visual-diff-compare.sh`.

## Viewing Results

After comparison, read the diff images to evaluate:

1. Resize each diff image for token efficiency:
   ```
   sips -Z 800 /tmp/visual-diff/diff/<tab>.png --out /tmp/visual-diff-resized/<tab>.png
   ```
2. Use the Read tool to display each resized diff image.

## Interpreting Diffs

Red pixels indicate differences between baseline and current screenshots.

- **Subpixel noise** (<200px): Scattered faint red dots from font antialiasing. Safe to ignore.
- **Dynamic content**: Avatars, timestamps, badges change between runs. Safe to ignore.
- **COLOR REGRESSION**: Entire icons or text areas are solid red — colors changed (e.g. icon went blue → gray). Investigate.
- **SIZE/POSITION REGRESSION**: Red outlines or doubled shapes — something shifted. Common cause: `Box2` adding `alignSelf: 'center'` where old code used `<div>`.
- **Rule of thumb**: Clean text labels + solid red icons = real bug, not noise.

## Typical Session

1. User says "take baseline" → run the baseline capture step.
2. User makes code changes and restarts app.
3. User says "compare" or "take current" → run the current capture + comparison.
4. Display diff images and summarize findings: which tabs changed, whether changes look intentional or are regressions.
