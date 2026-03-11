---
name: electron-screenshot
description: This skill should be used when the user asks to "take a desktop screenshot", "screenshot the electron app", "show me the desktop app", "what does the app look like", or mentions checking the Electron/desktop UI visually.
---

Take a screenshot of the running Electron app via Playwright MCP and display it.

## Prerequisites

The Electron app must be running with remote debugging enabled:
```
KB_ENABLE_REMOTE_DEBUG=1 yarn start-hot
```
This launches Electron with `--remote-debugging-port=9222`.

## Steps

1. Close the DevTools tab first to avoid stale data. Use `browser_tabs` with action=list, then action=close on the DevTools tab (usually index 0).

2. Select the main app window tab (the one titled "Keybase: ..." — usually index 1 after DevTools is closed it becomes index 0). Use `browser_tabs` with action=list then action=select.

3. Take a screenshot with `browser_take_screenshot`.

4. The screenshot is saved to a temp file. Resize it for token efficiency:
   ```
   sips -Z 800 <screenshot_path> --out /tmp/electron-screenshot.png
   ```

5. Use the Read tool to display `/tmp/electron-screenshot.png` to the user.

## Error Handling

- If Playwright MCP cannot connect, tell the user the Electron app may not be running with remote debugging. Suggest launching with `cd shared && KB_ENABLE_REMOTE_DEBUG=1 yarn start-hot`.
- If `sips` fails, fall back to displaying the original screenshot directly.

## Notes

- Tab 0 is typically DevTools, Tab 1 is the main app, Tab 2 is the menubar. Always close DevTools first — when it's open, `browser_evaluate` and `browser_snapshot` run against DevTools instead of the app.
- 800px max dimension gives good legibility with ~90% token savings.
