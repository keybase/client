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

Run the following script from `shared/` — it checks all packages including pre-release ones, and handles cases where the current version is *ahead* of the `latest` dist-tag (e.g., expo 56.x while latest still points to 55.x):

```bash
cd shared && python3 ../.claude/skills/update-dependencies/check-outdated.py
```

**Important:** The `latest` dist-tag on npm sometimes lags behind the version line the project tracks (e.g., expo 56.x while npm `latest` still points to 55.x). The script handles this by comparing semver and never suggesting a downgrade. Always sanity-check results — if a "latest" version is lower than current, it's a false positive.

Packages currently on pre-release lines:

- `@legendapp/list` — beta
- `@typescript/native-preview` — dev builds
- `react-native-gesture-handler` — beta
- `@react-navigation/*` — alpha
- `expo` — preview
- `eslint-plugin-react-compiler` — rc

**Note on `eslint-plugin-react-compiler` rc versions:** npm may have rc.1-hash variants that sort after rc.2 alphabetically but are older. Verify manually if the script suggests downgrading to a hash-tagged rc.

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
