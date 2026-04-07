---
name: ios-screenshot
description: This skill should be used when the user asks to "take an iOS screenshot", "screenshot the simulator", "show me the iOS app", "what does the screen look like", or mentions checking the iOS simulator UI visually.
---

Take a screenshot of the booted iOS simulator and display it.

## Steps

1. Capture the screenshot from the booted iOS simulator:
   ```
   xcrun simctl io booted screenshot /tmp/ios-screenshot-full.png
   ```

2. Resize to 800px max dimension for token efficiency (reduces ~90% of tokens vs full 2556px resolution while staying legible):
   ```
   sips -Z 800 /tmp/ios-screenshot-full.png --out /tmp/ios-screenshot.png
   ```

3. Use the Read tool to display `/tmp/ios-screenshot.png` to the user.

4. Clean up the full-size temporary file:
   ```
   rm /tmp/ios-screenshot-full.png
   ```

## Error Handling

- If `xcrun simctl io booted screenshot` fails, tell the user no iOS simulator is currently booted and suggest they launch one (e.g. via Xcode or `xcrun simctl boot "iPhone 17 Pro"`).
- If `sips` fails, fall back to displaying the full-size screenshot directly.
