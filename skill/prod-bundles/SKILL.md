---
name: prod-bundles
description: Use when the user asks to build production bundles, check bundle sizes, audit tree-shaking, or verify mobile/desktop code separation. Covers both the desktop webpack prod build and the iOS/Android Metro bundle.
---

Build production bundles for both platforms and analyze them for correct tree-shaking.

## Build Commands

**Desktop (webpack):**
```bash
# From shared/
yarn desktop:build:prod
```
Output lands in `shared/desktop/dist/`. Prod bundles have no `.dev` or `.profile` suffix — filter with:
```bash
ls shared/desktop/dist/*.bundle.js | grep -v '\.dev\.' | grep -v '\.profile\.'
```

**iOS (Metro):**
```bash
# From shared/
yarn ios:jsbundle
```
Output: `shared/ios/dist/main.jsbundle`

**Android (Metro):**
```bash
# From shared/
yarn android:jsbundle
```
Output: `shared/android/dist/main.jsbundle`

## Tree-Shaking Audit

**Desktop — check mobile-only modules are absent:**
```bash
DIST=shared/desktop/dist
PROD=$(ls "$DIST"/*.bundle.js | grep -v '\.dev\.' | grep -v '\.profile\.')
for mod in expo-audio expo-location expo-video react-native-kb @gorhom/bottom-sheet lottie-react-native react-native-safe-area-context; do
  hits=$(echo "$PROD" | xargs grep -l "$mod" 2>/dev/null | wc -l | tr -d ' ')
  echo "$mod: $hits files"
done
```

**iOS bundle — check bare `isMobile`/`isElectron` are inlined as literals (Babel plugin):**
```bash
# Should report 0 occurrences — bare globals replaced with true/false at transform time
python3 -c "
import re
bundle = open('shared/ios/dist/main.jsbundle').read()
for name in ['isMobile', 'isElectron', 'isAndroid', 'isIOS']:
    real = [m for m in re.finditer(r'(?<![.\w{,])' + name + r'(?![:\w])', bundle)]
    print(f'{name} not as property/key: {len(real)} occurrences')
"
```

## Key Facts

- **Webpack (desktop)**: `DefinePlugin` replaces bare globals (`isMobile`, `isElectron`, etc.) with literals. Terser DCEs dead branches. Works cross-module.
- **Metro (iOS/Android)**: The `makePlatformPlugin` Babel plugin in `babel.config.js` inlines the same globals at transform time, enabling Metro's `constant-folding-plugin` to DCE dead branches.
- **Native-only module aliasing** (desktop): packages in `shared/native-only-modules.js` are aliased to `shared/null-module.js` by webpack. Changes to that file require clearing the webpack cache: `rm -rf shared/node_modules/.cache/webpack`.
- **Webpack cache invalidation**: `shared/desktop/webpack.config.mts` lists `buildDependencies` — if you add a new file that affects the build, add it there so cache auto-invalidates.
