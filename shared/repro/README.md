# Repro Project

Minimal React Native project to reproduce DynamicColorIOS header backgroundColor issue.

## Setup

1. Initialize a new React Native project:
   ```bash
   npx react-native@0.81.5 init ReproApp
   cd ReproApp
   ```

2. Install required dependencies:
   ```bash
   npm install react-native-screens@4.20.0 @react-navigation/native-stack@7.9.1 @react-navigation/native react-native-safe-area-context
   ```

3. Replace `App.js` with the contents from this repo's `App.js`

4. Replace `index.js` with the contents from this repo's `index.js`

5. For iOS:
   ```bash
   cd ios
   pod install
   cd ..
   ```

6. Run the app:
   ```bash
   npx react-native run-ios
   ```

## What to Test

The header backgroundColor uses `DynamicColorIOS` with:
- `light: 'green'`
- `dark: 'blue'`

Switch between light and dark mode in iOS settings to verify the header color changes.
