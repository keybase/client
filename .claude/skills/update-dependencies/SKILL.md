---
name: update-dependencies
description: Use when updating npm/yarn dependencies in shared/package.json. Use for routine dep bumps, security updates, or keeping packages current. Do NOT use for eslint, react-native, react, react-dom, react-is, react-native-*, or any package pinned to the Expo SDK version.
---

# Updating Dependencies

## Packages to NEVER update with this skill

These are pinned to specific versions for compatibility reasons — do not touch:
- `react`, `react-dom`, `react-is`, `react-test-renderer` — must match Expo SDK
- `react-native` and all `react-native-*` packages
- `@react-native/*`

`expo` and `expo-*` packages **can** be updated, but update them all together in one pass since they are versioned in sync.

## Process

### 1. Check what's outdated

```bash
cd shared && yarn outdated
```

This shows current, wanted, and latest versions.

### 2. For packages with beta/dev/canary versions

If `yarn outdated` shows a pre-release version or you suspect one exists, check all available versions:

```bash
cd shared && yarn info <package> versions
```

Choose the most recent **stable** version unless the project already tracks a pre-release line (e.g., `@typescript/native-preview` tracks dev builds).

### 3. Edit package.json with exact versions

- Use **exact versions only** — no `^` or `~`
- Edit `shared/package.json` directly
- Update only the packages you intend to change

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

This regenerates `shared/desktop/electron-sums.tsx` with the correct SHA256 checksums for all platforms.

## Packages held back — flag to user

These are outdated but skipped until ecosystem support improves. Always mention them at the end so the user can decide:

- **`eslint`** — v10 available but `typescript-eslint` v9 (required for eslint 10 compat) doesn't exist yet.
- **`react-error-boundary`** — v6 available (major bump from v5); skipping until manually evaluated.

## Notes

- `lodash` types (`@types/lodash`, `@types/lodash-es`) can be updated independently of lodash itself.
- `@types/react`, `@types/react-dom`, `@types/react-is` should stay in sync with their runtime counterparts — update only if the runtime version changed.
- When in doubt whether a package is Expo-managed, check if its version matches the `expo` SDK version pattern (e.g., `55.x.x`).
