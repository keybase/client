---
name: update-dependencies
description: Use when updating npm/yarn dependencies in shared/package.json. Use for routine dep bumps, security updates, or keeping packages current.
---

# Updating Dependencies

## Packages to NEVER update with this skill

These are pinned to the Expo SDK version — do not touch:

- `react`, `react-dom`, `react-is`, `react-test-renderer` — must match Expo SDK
- `react-native` — must stay on the minor version Expo SDK expects (e.g., Expo 56 → react-native 0.85.x). Do NOT update across minor versions.
- `@react-native/babel-preset`, `@react-native/eslint-config`, `@react-native/metro-config` — must match the `react-native` version (e.g., react-native 0.85.x → these stay at 0.85.x). Do NOT update across minor versions.

`expo` and `expo-*` packages **can** be updated, but update them all together in one pass since they are versioned in sync.

## Process

### 1. Check what's outdated

```bash
cd shared && yarn outdated
```

This shows current, wanted, and latest versions.

### 2. Check pre-release packages manually

`yarn outdated` does **not** show updates for packages currently on a pre-release version (beta, alpha, dev, canary, rc). After running `yarn outdated`, also check these packages manually:

```bash
cd shared && yarn info @legendapp/list versions
```

For each pre-release package in `package.json`, run `yarn info <package> versions` and pick the most recent version in the same pre-release line (e.g., still beta if currently beta). Do not promote to stable unless intentional.

Packages currently on pre-release lines that need manual checking:

- `@legendapp/list` — beta
- `@typescript/native-preview` — dev builds
- `react-native-gesture-handler` — beta

If `yarn outdated` shows a pre-release version or you suspect one exists for other packages, check with `yarn info <package> versions`.

Choose the most recent **stable** version unless the project already tracks a pre-release line.

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
- Packages with versions matching the `expo` SDK pattern (e.g., `56.x.x`) are `expo-*` packages and can be updated together.
