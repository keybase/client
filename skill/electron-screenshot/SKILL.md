---
name: electron-screenshot
description: This skill should be used when the user asks to "take a desktop screenshot", "screenshot the electron app", "show me the desktop app", "what does the app look like", or mentions checking the Electron/desktop UI visually.
---

Take a screenshot of the running Electron app with `playwright-cli` and display it. The playwright-cli skill's "Connecting to the Electron App" section has the details on attaching and tab selection.

## Prerequisites

The Electron app must be running with remote debugging enabled:
```
cd shared && KB_ENABLE_REMOTE_DEBUG=1 yarn desktop:start:hot
```
This launches Electron with `--remote-debugging-port=9222`.

## Steps

1. Attach (once per session; `--persistent` is required for Electron):
   ```
   PLAYWRIGHT_MCP_CDP_ENDPOINT=http://localhost:9222 playwright-cli open --persistent
   ```

2. Select the main app window. Tab order is not stable, so never reuse a remembered index: run `playwright-cli tab-list`, `playwright-cli tab-select <index>` on the row whose URL contains `main.html`, and confirm with `playwright-cli eval "location.href"`.

3. Take the screenshot:
   ```
   playwright-cli screenshot --filename=/tmp/electron-screenshot-full.png
   ```

4. Resize it for token efficiency:
   ```
   sips -Z 800 /tmp/electron-screenshot-full.png --out /tmp/electron-screenshot.png
   ```

5. Use the Read tool to display `/tmp/electron-screenshot.png` to the user. If it shows the menubar or DevTools instead of the main window, go back to step 2.

## Error Handling

- If playwright-cli cannot connect, tell the user the Electron app may not be running with remote debugging. Suggest launching with `cd shared && KB_ENABLE_REMOTE_DEBUG=1 yarn desktop:start:hot`.
- If `sips` fails, fall back to displaying the full-size screenshot directly.

## Notes

- 800px max dimension gives good legibility with ~90% token savings.
