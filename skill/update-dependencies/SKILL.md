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

When the highest stable version is on a **newer major** than the current one, the script also reports the highest version reachable **within the current major** as a separate `(in-major)` line, with the major jump flagged below it:

```
  @babel/core: 7.29.7 -> 7.30.0  (in-major)
      ↳ MAJOR jump available: -> 8.0.1 (major 7 -> 8)
```

Take the `(in-major)` bump as the safe routine upgrade; treat the `↳ MAJOR jump` as an opt-in decision (peer-dep checks, app build to verify). If no in-major upgrade exists (already on the latest minor/patch of the current major), only the single `cur -> latest` line prints — the jump to the next major is then the only available upgrade.

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
yarn ios:pod:install
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

### 4b. Security audit

After `yarn`, run:

```bash
cd shared && python3 ../.claude/skills/update-dependencies/check-audit.py
```

This runs `yarn audit --json`, dedupes the advisories, and cross-references `yarn.lock` to suggest the cheapest fix for each one:

- **DIRECT** — the vulnerable package is in our `package.json`. Bump it there (exact version), run `yarn`.
- **LOCKFILE** — transitive, and the patched version satisfies every range that requires it. Delete the listed entry block(s) from `yarn.lock` (the entry key line plus its indented lines), then run `yarn` — it re-resolves to the patched version with no `package.json` change.
- **RESOLUTION** — transitive, but the patched version is outside the range the parent accepts. Bumping the **direct dependency that pulls it in** (first segment of the `via:` path) is the better fix when possible — but if you already brought direct deps current in steps 1–4, a still-flagged advisory means no released parent fixes it yet (confirm with `npm view <parent> dependencies` only if you skipped updating that parent). Then add the suggested `resolutions` entry. Prefer scoping it to the vulnerable parent (e.g. `"xcode/uuid"`) over a blanket `"**/uuid"` when some installed copies are already on a safe version — forcing a major-version jump on every consumer risks breaking ones that were fine. If ALL installed versions are vulnerable (the `installed:` line lists every copy), a blanket `**/` resolution is correct and covers them all with one entry. If multiple advisories suggest different versions for the same module, add ONE resolution entry with the highest version.
- **NO-FIX** — no patched version published. Don't work around it; report it to the user with the advisory link.

After applying fixes: re-run `yarn`, re-run this script to confirm clean, and re-run the dupes check (4a) — resolutions can change the dedupe picture. A forced major bump via `resolutions` runs code the parent package never tested with. "Verify" means: `yarn lint` + `yarn tsc` always; if the forced package sits under runtime app code, also build/run the app; if it sits under tooling (test runners, bundler, patch-package), run that tool once if cheap. Either way, explicitly tell the user which packages were force-bumped so they can watch for fallout.

### 5. Evaluate existing patches

After `yarn`, check whether any `patches/*.patch` files target a package you just updated — the filename encodes the version (e.g. `@legendapp+list+3.0.0-beta.56.patch`). For each such patch:

1. Run `yarn patch-package` to see if it applies cleanly.
2. If it **fails**: the patch still addresses a real issue, but the upstream source has moved. Fix the source files in `node_modules` directly (re-apply the intent of the patch), then run `yarn patch-package <package>` to regenerate it. Delete the old patch file.
3. If it **applies**: check whether the fix was merged upstream by searching the updated source for the patched code. If the upstream already has the fix, delete the patch file.

**Never rename patch files or hand-edit the `.patch` file itself.** Let `patch-package` generate the correctly-named file from your source edits.

### 6. If updating `electron`

After bumping the `electron` version in `package.json` and running `yarn`, update the download hashes:

```bash
cd shared && ./desktop/extract-electron-shasums.sh <new-version>
```

This regenerates `shared/desktop/electron-sums.mts` with the correct SHA256 checksums for all platforms.

## Notes

- `lodash` types (`@types/lodash`, `@types/lodash-es`) can be updated independently of lodash itself.
- **Always bump `@types/react` to the latest patch the script finds, even if runtime `react` is unchanged.** DefinitelyTyped ships type-only patches independent of the react runtime version. When you bump it, update the `resolutions` entry (`**/@types/react`) to the SAME version — multiple installed copies of `@types/react` cause type conflicts.
- `@types/react-dom`, `@types/react-is` should stay in sync with their runtime counterparts — update only if the runtime version changed.
- Packages with versions matching the `expo` SDK pattern (e.g., `56.x.x`) are `expo-*` packages and can be updated together.
- **`@react-navigation/core` must track what `@react-navigation/native` actually resolves**, not just the surface number of the other nav packages. `@react-navigation/native` (alpha.24) and `@react-navigation/core` (alpha.15/alpha.16) use different numbering — they are NOT in sync by design. Always check-outdated on `@react-navigation/core` and accept upgrades the script finds, even if the number looks unrelated to the other nav alpha versions. Skipping this causes duplicate installs and React context identity mismatches at runtime.
