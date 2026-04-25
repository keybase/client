---
name: update-dependencies
description: Use when updating npm/yarn dependencies in shared/package.json. Use for routine dep bumps, security updates, or keeping packages current.
---

# Updating Dependencies

## Packages to NEVER update with this skill

These are pinned to the Expo SDK version — do not touch:
- `react`, `react-dom`, `react-is`, `react-test-renderer` — must match Expo SDK
- `react-native` — must stay on the minor version Expo SDK expects (e.g., Expo 55 → react-native 0.83.x). Do NOT update across minor versions.
- `@react-native/babel-preset`, `@react-native/eslint-config`, `@react-native/metro-config` — must match the `react-native` version (e.g., react-native 0.83.x → these stay at 0.83.x). Do NOT update across minor versions.

`expo` and `expo-*` packages **can** be updated, but update them all together in one pass since they are versioned in sync.

## Packages held back — always skip and announce

These are outdated but blocked due to known compatibility issues. Always echo that you are skipping them:

```
Skipping react-error-boundary — held back: v6.x not compatible with our bundling setup
```

- **`react-error-boundary`** — v6.x not compatible with our bundling setup

## ESLint 10 notes

ESLint was upgraded to v10. The following were added to support it:
- `@eslint/js` — previously bundled with ESLint 9, now a separate package
- `@eslint/compat` — used in `eslint.config.mjs` via `fixupConfigRules` to wrap `eslint-plugin-react` (which still uses deprecated `context.getFilename()` API removed in ESLint 10)

If updating `eslint-plugin-react` to a version that supports ESLint 10 natively, remove the `fixupConfigRules` wrapper in `eslint.config.mjs` and potentially drop `@eslint/compat`.

## Process

### 1. Check what's outdated

```bash
cd shared && yarn outdated
```

This shows current, wanted, and latest versions.

### 2. For packages with beta/dev/canary versions

If `yarn outdated` shows a pre-release version or you suspect one exists:

```bash
cd shared && yarn info <package> versions
```

Choose the most recent **stable** version unless the project already tracks a pre-release line (e.g., `@typescript/native-preview` tracks dev builds).

### 3. Edit package.json with exact versions

- Use **exact versions only** — no `^` or `~`
- Edit `shared/package.json` directly
- Update only the packages you intend to change
- Verify no `^` or `~` are present before saving

### 4. Install and validate

```bash
cd shared && yarn
yarn lint
yarn tsc
yarn pod-install
```

Fix any issues before proceeding.

### 5. If updating `electron`

After bumping the `electron` version in `package.json` and running `yarn`, update the download hashes:

```bash
cd shared && ./desktop/extract-electron-shasums.sh <new-version>
```

This regenerates `shared/desktop/electron-sums.mts` with the correct SHA256 checksums for all platforms.

## Notes

- `lodash` types (`@types/lodash`, `@types/lodash-es`) can be updated independently of lodash itself.
- `@types/react`, `@types/react-dom`, `@types/react-is` should stay in sync with their runtime counterparts — update only if the runtime version changed.
- Packages with versions matching the `expo` SDK pattern (e.g., `55.x.x`) are `expo-*` packages and can be updated together.
