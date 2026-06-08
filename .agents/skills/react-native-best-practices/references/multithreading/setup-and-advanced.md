# Setup and Advanced Topics

---

## Installation

### Expo (SDK 54+)

Expo includes the Worklets Babel plugin by default since SDK 54. Install and rebuild:

```bash
npx expo install react-native-worklets
npx expo prebuild
```

### React Native Community CLI

Install the package and add the Babel plugin manually:

```bash
npm install react-native-worklets
```

```js
// babel.config.js
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    'react-native-worklets/plugin',
  ],
};
```

Then clear the Metro cache and install iOS pods:

```bash
npm start -- --reset-cache
cd ios && pod install && cd ..
```

### Prerequisites

Worklets requires the New Architecture (Fabric). It is untested on the Legacy Architecture (Paper).

Supported platforms: Android, iOS, macOS, tvOS, visionOS, Web.

---

## Babel Plugin

The Worklets Babel plugin transforms functions marked with `'worklet'` into serializable objects that can run on Worklet Runtimes. It also autoworkletizes callbacks passed to Worklets APIs (`scheduleOnUI`, `scheduleOnRuntime`, etc.) and Reanimated/Gesture Handler hooks.

### What can be a worklet

- Function declarations, function expressions, arrow functions, and object methods with `'worklet';` as the first statement.
- Callbacks passed to autoworkletized APIs (no directive needed).
- All top-level functions in files that start with `'worklet';` at the file level.

### Worklet Context Objects

Object methods lose their `this` binding on the UI thread. Worklet Context Objects preserve it:

```tsx
const counter = {
  __workletContextObject: true,
  count: 0,
  increment() {
    this.count += 1; // `this` is preserved
  },
};
```

Changes on the UI thread are visible only on the UI thread. Changes on the JS thread are visible only on the JS thread.

### Worklet Classes

Hermes doesn't support native classes on Worklet Runtimes. Mark a class with `__workletClass = true` to make it instantiable on the UI thread:

```tsx
class Particle {
  __workletClass = true;
  x = 0;
  y = 0;
  update(dt: number) {
    this.x += dt;
  }
}

scheduleOnUI(() => {
  const p = new Particle();
  p.update(16);
});
```

Limitations: no inheritance, no static members, instances cannot be shared between threads.

### Key plugin options

Configure by passing an options object to the Babel plugin:

```js
/** @type {import('react-native-worklets/plugin').PluginOptions} */
const workletsPluginOptions = {
  bundleMode: true,
  strictGlobal: true,
  globals: ['myGlobalVar'],
};

// babel.config.js
plugins: [['react-native-worklets/plugin', workletsPluginOptions]];
```

| Option | Default | Purpose |
|--------|---------|---------|
| `bundleMode` | `false` | Enable Bundle Mode (full bundle on all runtimes) |
| `strictGlobal` | `false` | Prevent implicit capture of globals. Recommended. |
| `globals` | `[]` | Identifiers that should not be copied to worklet runtimes |
| `disableWorkletClasses` | `false` | Disable Worklet Classes (needed for Custom Serializables with `new`) |
| `workletizableModules` | `[]` | Allow-list of third-party modules usable on Worklet Runtimes in Bundle Mode |
| `omitNativeOnlyData` | `false` | Smaller bundles for Web builds |
| `substituteWebPlatformChecks` | `false` | Helps tree-shaking for Web builds |

### Pitfalls

- **Worklets are not hoisted.** Using a workletized function before its declaration crashes at runtime.
- **Imported functions need explicit `'worklet'` directive.** Autoworkletization only applies within the same file.
- **Conditional expressions bypass autoworkletization.** Add `'worklet';` to each branch manually.

---

## Bundle Mode (Experimental)

Bundle Mode gives worklets access to the full JavaScript bundle, allowing third-party libraries to run on Worklet Runtimes without patching.

### Setup

1. Install the bundle-mode-preview tag: `npm i react-native-worklets@bundle-mode-preview`
2. Enable in Babel config: `bundleMode: true, strictGlobal: true`
3. Configure Metro with `getBundleModeMetroConfig`:

```js
// metro.config.js (Expo)
const { getBundleModeMetroConfig } = require('react-native-worklets/bundleMode');
let config = getDefaultConfig(__dirname);
config = getBundleModeMetroConfig(config);
module.exports = config;
```

4. Enable the `BUNDLE_MODE_ENABLED` static feature flag in `package.json`:

```json
{
  "worklets": {
    "staticFeatureFlags": {
      "BUNDLE_MODE_ENABLED": true
    }
  }
}
```

5. Patch `metro` and `metro-runtime` for seamless bundling and fast refresh (see the Worklets repository for patch files).

### Using third-party libraries in worklets

Libraries must be on an allow-list via the `workletizableModules` Babel plugin option:

```js
workletizableModules: ['my-library'],
```

Libraries that import React Native internals cannot run on Worklet Runtimes (they would load a second RN instance).

### Networking in worklets

Enable `fetch` on Worklet Runtimes by adding the `FETCH_PREVIEW_ENABLED` feature flag (requires `BUNDLE_MODE_ENABLED`).

---

## Feature Flags

Static feature flags go in `package.json` under `worklets.staticFeatureFlags`. They require a native rebuild.

| Flag | Default | Purpose |
|------|---------|---------|
| `BUNDLE_MODE_ENABLED` | `false` | Enable Bundle Mode |
| `FETCH_PREVIEW_ENABLED` | `false` | Enable `fetch` on Worklet Runtimes (requires Bundle Mode) |
| `IOS_DYNAMIC_FRAMERATE_ENABLED` | `true` | Auto-adjust frame rate for expensive animations (falls back from 120fps to 60fps) |

Static flags are unavailable in Expo Go. Use Expo Prebuild instead.

Dynamic flags can be toggled at runtime via `setDynamicFeatureFlag('FLAG_NAME', true)`.

---

## Testing with Jest

### Mock implementation (recommended)

```js
// TypeScript
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));

// JavaScript
jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'));
```

### Web implementation (v0.8+)

Override the Jest resolver to use the Web implementation instead of native:

```js
// jest.config.js
module.exports = {
  resolver: 'react-native-worklets/jest/resolver',
};
```

---

## Troubleshooting

### "Failed to create a worklet"

The Babel plugin is missing. Add `'react-native-worklets/plugin'` to `babel.config.js` and rebuild.

### "Native part of Worklets doesn't seem to be initialized"

Rebuild the app after installing or upgrading. If using a brownfield app, initialize the native library manually.

### Version mismatch errors

Clear the Metro cache: `npm start -- --reset-cache`. If the issue persists, a dependency bundles worklets transpiled with an older Babel plugin version.

### "Tried to modify key of an object which has been converted to a serializable"

The object was captured in a worklet's closure and later mutated. In dev builds, captured objects are frozen to surface this mistake. Solutions:
- Use `useSharedValue` for values that change over time.
- Destructure only the needed properties into local variables before the worklet captures them.

### "Tried to synchronously call a non-worklet function on the UI thread"

The called function lacks a `'worklet';` directive. Either add `'worklet';` to make it run on the UI thread, or wrap the call with `scheduleOnRN(fn)` to run it on the JS thread.

---

## Compatibility

Worklets supports at least the last three minor versions of React Native. Check the compatibility table in the official docs for exact version mappings.
