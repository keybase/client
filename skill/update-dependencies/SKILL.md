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

Run the following script from `shared/` — it checks all packages and derives pre-release vs stable from each package's current version automatically (no manual list to maintain):

```bash
cd shared && python3 ../.claude/skills/update-dependencies/check-outdated.py
```

The script never suggests a downgrade. For packages currently on a stable version it finds the highest stable version. For packages currently on a pre-release version it finds the highest semver on the same major — which handles both newer pre-releases and graduation to stable (e.g. `56.0.0-preview.x` → `56.0.5`).

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

**Lint/tsc failures after a dep update are caused by the update** — do not try to prove they are pre-existing. The branch is clean before the update starts, so any new errors are ours to fix. Fix them before proceeding. If the failures are large or unclear, stop and ask for guidance rather than guessing.

### 4a. Check for duplicate package installs

After `yarn`, run:

```bash
cd shared && python3 ../.claude/skills/update-dependencies/check-dupes.py
```

This finds packages where a nested `node_modules` contains a **newer** version than what's installed at the top level — the case where bumping our pin in `package.json` would let yarn deduplicate. It ignores nested installs that are older (locked by their parent packages, not fixable by bumping our pins).

**If duplicates are found:** Update the version in `package.json` to the suggested version, then re-run `yarn`.

**Why this matters:** Packages that use `React.createContext()` or other module-level singletons break silently when installed twice — the provider uses one instance and the consumer reads a different one. Classic symptom: "Couldn't determine focus state. Is your component inside a screen in a navigator?" (`useIsFocused` from `@react-navigation/core`).

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
- **`@react-navigation/core` must track what `@react-navigation/native` actually resolves**, not just the surface number of the other nav packages. `@react-navigation/native` (alpha.24) and `@react-navigation/core` (alpha.15/alpha.16) use different numbering — they are NOT in sync by design. Always check-outdated on `@react-navigation/core` and accept upgrades the script finds, even if the number looks unrelated to the other nav alpha versions. Skipping this causes duplicate installs and React context identity mismatches at runtime.
