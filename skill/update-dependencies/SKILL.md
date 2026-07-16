---
name: update-dependencies
description: Use when updating npm/yarn dependencies in shared/package.json, protocol/, or rnmodules/react-native-kb/. Use for routine dep bumps, security updates, or keeping packages current.
---

# Updating Dependencies

## Packages to NEVER update with this skill

These are pinned to the Expo SDK version — do not touch:

- `react`, `react-dom`, `react-is`, `react-test-renderer` — must match Expo SDK
- `react-native` — must stay on the minor version Expo SDK expects (e.g., Expo 56 → react-native 0.85.x). Do NOT update across minor versions.
- `@react-native/babel-preset`, `@react-native/eslint-config`, `@react-native/metro-config` — must match the `react-native` version (e.g., react-native 0.85.x → these stay at 0.85.x). Do NOT update across minor versions.

`expo` and `expo-*` packages **can** be updated, but update them all together in one pass since they are versioned in sync.

**`webpack-dev-server`: do NOT go past `5.x`.** v6 deleted the SockJS client, but `@pmmmwh/react-refresh-webpack-plugin` (latest 0.6.2, peer range `^4.8.0 || 5.x`) still hard-`require`s `webpack-dev-server/client/clients/SockJSClient` in `sockets/WDSSocket.js` — so wds6 breaks desktop hot mode at compile time (`ModuleNotFoundError`). Stay on the latest `5.x` (currently 5.2.6). Only move to wds6 once @pmmmwh ships a release whose peer range includes `6.x`, or after migrating the bundler off webpack (see Rspack notes elsewhere). See memory [[project_wds6_react_refresh_sockjs]].

**`typescript` is intentionally split into two packages — do NOT collapse them yet.** TypeScript 7.x is the native (Go) rewrite: fast, but it does NOT ship the classic JS compiler API (`ts.isCallExpression`, `ts.forEachChild`, `ts.Extension.*`, etc.). Two consumers here still require that classic API: `typescript-eslint` (its `@typescript-eslint/typescript-estree` crashes at module-load on TS7 with `Cannot read properties of undefined (reading 'Cjs')`, and its peer range is `>=4.8.4 <6.1.0` even on canary), and `scripts/analyze-styles.mts` (imports `typescript` and walks the AST). So:
- `"typescript": "6.0.3"` — the classic-API package. Bare `import 'typescript'` resolves here (eslint parser + analyze-styles). Keep on the latest `6.x`; do NOT bump to `7.x`.
- `"typescript-native": "npm:typescript@7.0.2"` — TS7 native, aliased so it doesn't take the bare `typescript` name. Used ONLY as the `tsc` CLI, invoked by explicit path in the `tsc` script (`./node_modules/typescript-native/bin/tsc`). This replaced the old `@typescript/native-preview` (`tsgo`) dependency. Bump this to the latest stable `typescript@7.x` on each pass.

When `typescript-eslint` ships a release that accepts TS7 (peer range includes `>=7`, and typescript-estree no longer reads the classic API off the `typescript` module): bump `typescript-eslint`, set `"typescript": "<that 7.x>"`, delete the `typescript-native` alias, and repoint the `tsc` script back to `./node_modules/.bin/tsc`. Verify `analyze-styles.mts` still type-checks (it may need porting to the TS7 API). Until then the split stays.

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
```

**Lint/tsc failures after a dep update are caused by the update** — do not try to prove they are pre-existing. The branch is clean before the update starts, so any new errors are ours to fix. Fix them before proceeding. If the failures are large or unclear, stop and ask for guidance rather than guessing.

### 4d. iOS pods — clean when native deps changed

Plain `pod install` only re-integrates the Pods project; it leaves `ios/build/` (stale `.o`, `.pcm` module cache, generated headers) and `ios/Pods/` framework/header caches from the *previous* versions. Xcode's incremental build trusts those by timestamp and then compiles/links against headers and symbols that moved when a pod's source was swapped underneath it → build fails out of the box. This bites almost every time a **native** dependency version changes.

A native dep = anything with an iOS pod: any `expo`/`expo-*`, `react-native`, `react-native-*`, `@react-native-*`, `lottie-react-native`, `react-native-kb`, etc. Pure JS/tooling bumps (webpack, babel, eslint, typescript, immer, lodash, zustand, `@types/*`) do **not** need a pod clean.

**If any native dep changed**, do the targeted clean instead of a plain install:

```bash
cd shared/ios && rm -rf build Pods && cd .. && yarn ios:pod:install
```

This drops both stale caches without nuking the global CocoaPods cache or re-resolving from scratch — it's the reliable fix for the "Xcode won't compile after a bump" case. Keep `Podfile.lock` (don't delete it) so resolution stays stable.

**Escalate to a full clean only if the targeted clean still fails to build** (e.g. `react-native-kb` codegen went stale, or a corrupted global pod cache):

```bash
cd shared && yarn ios:pod:clean && yarn ios:pod:install
```

`ios:pod:clean` additionally runs `pod cache clean --all` (global re-fetch of pod source) and wipes `react-native-kb/node_modules` — heavier and rarely the actual fix, so it's the fallback, not the default.

**If only JS/tooling deps changed**, a plain `yarn ios:pod:install` (or skipping pods entirely) is fine.

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

  Yarn 1 gotchas for scoped resolutions: write the scope as `"**/xcode/uuid"` — the documented bare `"xcode/uuid"` form is silently ignored. And a resolution alone does NOT rewrite an existing lockfile entry: delete the stale entry block (e.g. `uuid@^7.0.3:`) from `yarn.lock` and re-run `yarn` so the range re-resolves through the resolution. Verify by checking the nested install (`node_modules/<parent>/node_modules/<pkg>/package.json`), not just the lockfile.
- **NO-FIX** — no patched version published. Don't work around it; report it to the user with the advisory link.

After applying fixes: re-run `yarn`, re-run this script to confirm clean, and re-run the dupes check (4a) — resolutions can change the dedupe picture. A forced major bump via `resolutions` runs code the parent package never tested with. "Verify" means: `yarn lint` + `yarn tsc` always; if the forced package sits under runtime app code, also build/run the app; if it sits under tooling (test runners, bundler, patch-package), run that tool once if cheap. Either way, explicitly tell the user which packages were force-bumped so they can watch for fallout.

### 4c. Minimize existing resolutions

Keep the `resolutions` block as small as possible — every entry overrides yarn's normal resolution forever and goes stale silently. Two failure modes of stale entries: (1) the entry is redundant because all requesting ranges now resolve to a safe version on their own; (2) the entry actively **downgrades** a parent's newer pin (e.g. a `**/uuid: 11.1.1` left in place forced `@appium/support`'s exact `uuid@14.0.0` down to 11).

On every dep-update pass, audit each entry (except `**/@types/react`, which is permanent — see Notes):

1. Remove the candidate entries from `package.json`, run `yarn`, then re-run the audit script (4b) and dupes script (4a).
2. If both come back clean, the entries were redundant — leave them removed.
3. If an advisory returns, that entry is still needed: restore it, bumped to the **latest** patched version (not just the minimum the advisory names).

Testing removal is one `yarn` run — always do it empirically rather than reasoning from lockfile ranges.

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

## Other manifests: protocol/ and rnmodules/react-native-kb/

Dependabot also watches `protocol/yarn.lock` and `rnmodules/react-native-kb/yarn.lock`. Cover them on each pass — the same scripts work there (`check-outdated.py` reads the cwd's `package.json` and skips `file:`/`link:`/`github:` deps automatically).

### protocol/

- Direct deps are tiny; the real tree comes from `avdl-compiler` (pinned to `github:keybase/node-avdl-compiler#master`), which exact-pins transitives (e.g. `lodash "4.17.15"`) — LOCKFILE deletion can't help, so vulnerable transitives need `resolutions`. Current block: `"**/lodash"`, `"**/underscore"` (underscore is pulled via jison → nomnom, which pins `1.1.x`).
- **Verify** any forced bump by running the codegen end-to-end: `cd protocol && make clean && make` must exit 0 AND leave `git status` clean outside `protocol/package.json`+`yarn.lock` — the generated output (json/, go/protocol/, shared TS) must be byte-identical.

### rnmodules/react-native-kb/

- Only one real (non-`file:`) devDep: `react-native-builder-bob`. **Do NOT bump past 0.40.x** — 0.43+ validates the `main` field with `require.resolve` and fails on this module's source-pointing layout (`"main": "src/index"` → `src/index.tsx`). Fixing that means repackaging the module; out of scope for a dep pass.
- `yarn` in this directory fails at the `prepare` script (`bob build`) with `Error: Found incorrect path in 'main' field` — this is pre-existing (fails on a clean checkout too) and harmless: the app consumes the module's `src/` directly via the `file:` dep + sync, so bob's `lib/` output is unused. Use `yarn --ignore-scripts` to install/re-resolve the lockfile.
- Everything vulnerable here is transitive dev tooling (babel/metro chain). Fix by deleting the vulnerable entry blocks from `yarn.lock` and re-running `yarn --ignore-scripts` — the ranges are loose (`^`), so they re-resolve to patched versions with no `package.json` change.

### go/chat/flip/

Has a `package.json` solely so `make` can `npm i` the avdl compiler for one-off codegen. Its `package-lock.json` was deliberately deleted (2026-07) to kill stale dependabot alerts — don't recreate it; if `npm i` regenerates one during codegen, don't commit it.

## Notes

- `lodash` types (`@types/lodash`, `@types/lodash-es`) can be updated independently of lodash itself.
- **Always bump `@types/react` to the latest patch the script finds, even if runtime `react` is unchanged.** DefinitelyTyped ships type-only patches independent of the react runtime version. When you bump it, update the `resolutions` entry (`**/@types/react`) to the SAME version — multiple installed copies of `@types/react` cause type conflicts.
- `@types/react-dom`, `@types/react-is` should stay in sync with their runtime counterparts — update only if the runtime version changed.
- Packages with versions matching the `expo` SDK pattern (e.g., `56.x.x`) are `expo-*` packages and can be updated together.
- **`@react-navigation/core` must track what `@react-navigation/native` actually resolves**, not just the surface number of the other nav packages. `@react-navigation/native` (alpha.24) and `@react-navigation/core` (alpha.15/alpha.16) use different numbering — they are NOT in sync by design. Always check-outdated on `@react-navigation/core` and accept upgrades the script finds, even if the number looks unrelated to the other nav alpha versions. Skipping this causes duplicate installs and React context identity mismatches at runtime.
