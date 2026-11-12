---
name: update-dependencies
description: Use when updating npm/yarn dependencies in shared/package.json, protocol/, or rnmodules/react-native-kb/. Use for routine dep bumps, security updates, or keeping packages current.
---

# Updating Dependencies

## The react-native cluster

`react-native` is the anchor; everything else in this cluster follows it.

- **`react-native` itself is always upgradable.** Take the in-line bump (0.86.0 → 0.86.2) as routine. A version-line jump (0.86 → 0.87) is a **major** — opt-in, and it drags the whole cluster with it. The check script reports both, and filters out react-native's `1000.0.0` main-branch sentinel.
- `react`, `react-dom`, `react-is`, `react-test-renderer` — **pinned to whatever `react-native` requires**, never checked against npm on their own. When `react-native` moves, read its peer deps (`npm view react-native@<new> peerDependencies`) and sync these by hand.
- `@react-native/babel-preset`, `@react-native/eslint-config`, `@react-native/metro-config` — must stay on `react-native`'s version line (react-native 0.86.x → these stay 0.86.x), but minor bumps within it ARE fine (0.86.0 → 0.86.2) — take them on routine passes. The check script caps these to `react-native`'s line automatically, so bumping RN's line pulls them along.

> Version terminology in this project (all packages, not just react-native): a version-line change like 0.86 → 0.87 is a **major**; the last number (0.86.0 → 0.86.1) is a **minor**.

**Expo pins the RN version too.** `expo`, `@expo/cli`, `babel-preset-expo` and `@expo/prebuild-config` exact-pin `@react-native/*` (codegen, dev-middleware, debugger-frontend, …). If our `react-native` differs from that pin — including rc → final — yarn nests a second copy under Expo, and `check-dupes.py` does NOT flag it (it only reports nested copies newer than top level). After every RN or expo bump, run `find node_modules -path '*/node_modules/@react-native/*/package.json' -maxdepth 6` and confirm one version (react-native-web's old `normalize-colors` is expected). If they differ, hold RN and those expo packages at the matching versions until Expo ships a release that pins the new RN.

## Other version constraints

`expo` and `expo-*` packages **can** be updated, but update them all together in one pass since they are versioned in sync.

**`oxc-transform-react`: stay inside `@vitejs/plugin-react`'s peer range.** It is the Rust react-compiler behind `react({compiler: true})` in `vite.config.mts` (desktop only). For a 0.x version, `^0.145.0` means `0.145.x` only, so the check script's "latest" is usually outside the range — read `npm view @vitejs/plugin-react@<ver> peerDependencies` and pin the newest version inside it. Metro, jest and `lint:bailouts` still use `babel-plugin-react-compiler`, `yarn lint:bailouts` runs both and fails on any file where they memoize a different number of functions, so run it after bumping either compiler.

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

The script never suggests a downgrade. For packages currently on a stable version it finds the highest stable version at or below the `latest` dist-tag (see below). For packages currently on a pre-release version it finds the highest semver on the same major — which handles both newer pre-releases and graduation to stable (e.g. `56.0.0-preview.x` → `56.0.5`).

When the highest stable version is on a **newer major** than the current one, the script also reports the highest version reachable **within the current major** as a separate `(in-major)` line, with the major jump flagged below it:

```
  @babel/core: 7.29.7 -> 7.30.0  (in-major)
      ↳ MAJOR jump available: -> 8.0.1 (major 7 -> 8)
```

Take the `(in-major)` bump as the safe routine upgrade; treat the `↳ MAJOR jump` as an opt-in decision (peer-dep checks, app build to verify). If no in-major upgrade exists (already on the latest minor/patch of the current major), only the single `cur -> latest` line prints — the jump to the next major is then the only available upgrade.

For packages on a stable version, suggestions are **capped at the `latest` dist-tag**, the same rule `npm install` follows. Max-semver alone is wrong here: during an Expo SDK preview, `expo-*` packages publish plain-looking `58.0.x` versions under `next` while `expo@latest` is still 57, so an uncapped check reports the unreleased SDK as a stable upgrade. Anything above `latest` goes in a separate `=== UPCOMING ===` section instead, labelled with the dist-tag(s) pointing at it (`[next]`, `[beta]`, `[alpha]`, `[rc]`; canary/nightly tags are skipped). That section is for awareness only. Tell the user what's there, but never take anything from it on a routine pass, and don't call it released or "available". A `[next]` tag on a stable-looking number (e.g. `expo-asset: 58.0.7 [next]`) still means unreleased.

### 3. Edit package.json with exact versions

- Use **exact versions only** — no `^` or `~`
- Edit `shared/package.json` directly
- Update only the packages you intend to change
- Verify no `^` or `~` are present before saving

### 4. Install and validate

```bash
cd shared && yarn
yarn lint:all
```

**Lint/tsc failures after a dep update are caused by the update** — do not try to prove they are pre-existing. The branch is clean before the update starts, so any new errors are ours to fix. Fix them before proceeding. If the failures are large or unclear, stop and ask for guidance rather than guessing.

### 4d. iOS pods — clean when native deps changed

Plain `pod install` only re-integrates the Pods project; it leaves `ios/build/` (stale `.o`, `.pcm` module cache, generated headers) and `ios/Pods/` framework/header caches from the *previous* versions. Xcode's incremental build trusts those by timestamp and then compiles/links against headers and symbols that moved when a pod's source was swapped underneath it → build fails out of the box. This bites almost every time a **native** dependency version changes.

A native dep = anything with an iOS pod: any `expo`/`expo-*`, `react-native`, `react-native-*`, `@react-native-*`, `lottie-react-native`, `react-native-kb`, etc. Pure JS/tooling bumps (vite, babel, eslint, typescript, immer, lodash, zustand, `@types/*`) do **not** need a pod clean.

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

After applying fixes: re-run `yarn`, re-run this script to confirm clean, and re-run the dupes check (4a) — resolutions can change the dedupe picture. A forced major bump via `resolutions` runs code the parent package never tested with. "Verify" means: `yarn lint:all` always; if the forced package sits under runtime app code, also build/run the app; if it sits under tooling (test runners, bundler, patch-package), run that tool once if cheap. Either way, explicitly tell the user which packages were force-bumped so they can watch for fallout.

### 4c. Minimize existing resolutions

Keep the `resolutions` block as small as possible — every entry overrides yarn's normal resolution forever and goes stale silently. Two failure modes of stale entries: (1) the entry is redundant because all requesting ranges now resolve to a safe version on their own; (2) the entry actively **downgrades** a parent's newer pin (e.g. a `**/uuid: 11.1.1` left in place forced `@appium/support`'s exact `uuid@14.0.0` down to 11).

On every dep-update pass, audit each entry (except `**/@types/react`, which is permanent — see Notes):

1. Remove the candidate entries from `package.json`.
2. **Delete the forced entries from `yarn.lock` too** — find each entry whose resolved version was pinned by the resolution (e.g. `serialize-javascript@7.0.7, serialize-javascript@^6.0.2:`) and delete the block. This is the mirror of the "resolution alone does not rewrite the lockfile" gotcha in 4b: removing a resolution does NOT make yarn re-resolve either. The forced version lingers in `yarn.lock`, so the audit still sees the patched version and comes back **falsely clean** — then some later pass re-resolves the range down to the vulnerable version and the advisory returns.
3. Run `yarn`, then **confirm the installed version actually changed** (`grep -A1 '^<pkg>@' yarn.lock` or check `node_modules/<pkg>/package.json`) — if it still shows the previously-forced version, the removal test hasn't actually run yet.
4. Re-run the audit script (4b) and dupes script (4a).
5. If both come back clean, the entries were redundant — leave them removed.
6. If an advisory returns, that entry is still needed: restore it, bumped to the **latest** patched version (not just the minimum the advisory names — `npm view <pkg> version`), and remember to delete the now-stale unforced lockfile entry again so the resolution takes effect (4b gotcha).

Testing removal is one `yarn` run — always do it empirically rather than reasoning from lockfile ranges. But "empirically" means verifying the lockfile actually re-resolved (step 3), not just that `yarn` exited 0.

Known still-needed entries (as of 2026-09), all because a parent pins an old range: `**/serialize-javascript` (mocha, via @wdio/mocha-framework, still pins `^6.0.2` — GHSA-5c6j-r48x-rmvq, GHSA-qj8w-gfj5-8c6v) and `**/xcode/uuid` (xcode pins `^7.0.3`, no release since 2021 — GHSA-w5hq-g745-h8pq). Still run the removal test each pass (a parent may finally ship a fix), but expect these to survive it.

### 5. Evaluate existing patches

`shared/patches/README.md` records, for every change inside every patch, why it exists, its upstream issue or PR, when it can go and how to check. Start from it:

```bash
cd shared && python3 ../.claude/skills/update-dependencies/find-workarounds.py --patches
```

That prints each patch with its entries (upstream state, removal condition), flags a patch whose version no longer matches the installed package (this is how a transitive bump such as `metro` shows up), and fails if a patch or a file inside one has no entry. For each patch whose package moved:

1. **Re-check every entry's Upstream** against the version now installed: the issue or PR state (`gh issue view <n> --repo <owner>/<repo> --json state,closedAt`, read-only), and whether the fix is in the release we install, not only on main. An entry whose **Remove when** is now true means that hunk goes, even if the patch still applies.
2. Run `yarn patch-package` to see if it applies cleanly.
3. If it **fails**: find which entry's hunk failed. If upstream now contains that fix, drop the hunk. Otherwise the source moved: fix the files in `node_modules` directly (re-apply the intent the entry describes), then run `yarn patch-package <package>` to regenerate. Delete the old patch file.
4. If it **applies**: still search the updated source for each hunk's fix, since upstream may have fixed it differently in a place the hunk does not touch. Remove hunks that are no longer needed by reverting them in `node_modules` and regenerating; delete the patch file when none are left.
5. **Update the README in the same commit**: the date and state in each Upstream field you checked, and delete the entries (or the section) for anything removed. Re-run `--patches` until it passes.

**Never rename patch files or hand-edit the `.patch` file itself.** Let `patch-package` generate the correctly-named file from your source edits.

If you learn something about a patch while here (a wrong issue number in its comment, a second thing it covers), put it in the entry.

### 6. If updating `electron`

After bumping the `electron` version in `package.json` and running `yarn`, update the download hashes:

```bash
cd shared && ./desktop/extract-electron-shasums.sh <new-version>
```

This regenerates `shared/desktop/electron-sums.mts` with the correct SHA256 checksums for all platforms.

### 7. Look for new features worth adopting

A bump is also a chance to delete our own code. For every package you bumped, read what changed between the old and new version and decide whether anything in it is worth using here.

Read the **changelog or release notes**, not the file diff of `node_modules`: the notes say what the maintainers consider a feature, a fix or a deprecation, and a diff of built output doesn't.

- GitHub releases: `gh release view <tag> --repo <owner>/<repo>`, or `gh api repos/<owner>/<repo>/releases --jq '.[] | select(.tag_name=="<tag>") | .body'` for each version in the range (find the repo with `npm view <pkg> repository.url`).
- Monorepos and packages without releases: the package's `CHANGELOG.md` (it usually ships in `node_modules/<pkg>/CHANGELOG.md`, so no network is needed; expo packages all do this).
- Cover every version in the range, not only the newest one.

Skip packages whose range is patch-only bug fixes once the notes confirm that. Spend the time on version-line and feature releases.

For each entry, check it against this repo before reporting it:

- **A new API or option that replaces something we hand-rolled**: a workaround, a wrapper, a polyfill, a `patches/*.patch`, a `resolutions` entry. Grep for the code it would replace and name the file.
- **A fix for a bug we work around**: note it for step 8, which checks every workaround we have for the package.
- **A deprecation of something we use**: grep for the deprecated API and list the call sites, so it gets migrated before it is removed.
- **A new default or behavior change** that affects us even on a routine bump.

Adopting a feature is not part of the deps pass. Don't change app code for it in the bump commit: report each candidate (package and version, the changelog entry, the file it would touch, what we would gain) and let the user decide. Report "nothing worth adopting" when that is the answer, and say which changelogs you read.

### 8. Retire workarounds the bump may have made obsolete

Step 7 starts from the changelog. This step starts from our code, because maintainers fix bugs without writing them up, and a workaround outlives the bug it covered unless someone goes back for it. Do it for every package bumped in this pass.

**Inventory.** From `shared/`:

```bash
cd shared && python3 ../.claude/skills/update-dependencies/find-workarounds.py
```

With no arguments it takes the packages whose version differs from `master` (`--base <ref>` for another base, or pass package names). For each one it lists the `patches/` files, the `resolutions` entries, the comments anywhere in the repo that mention the package (all of them up to 40; past that, only those with a workaround signal within a few lines, such as an issue link, "until" or a version number, and `--all` for the rest), and the memory notes about it. Patches come with their `patches/README.md` entries and are settled by step 5, resolutions by 4c; the rest is this step's list.

The inventory is a floor. A workaround's comment often describes the symptom without naming the library, so also skim the files that use the package (`git grep -l "from '<pkg>"`) for code that exists only to correct the library: re-pins, remounts, deferred calls, extra measuring, guards around its calls. The script searches for the npm name and the names in its `ALIASES` table only; if comments call a package something else, add that name there.

**Check each one against the new version.** In order of cost:

1. A note that names a version ("drop at RN 0.89") is due when the bump reaches that version.
2. A linked upstream issue or PR: check it as in step 5.1 (read-only, never comment). Closed is a lead, not proof.
3. No link: read the changelog range from step 7, then the new source in `node_modules/<pkg>` for the behavior the workaround corrects.

For a patch-only bump, 1 and 2 are enough unless the notes mention the area.

**Prove it by removal.** A candidate is removable only once the workaround has been taken out locally and the original symptom failed to come back on the new version: the unit test that covers it still passes, a probe against the real library shows the fixed behavior, or the real app or a targeted e2e flow does. Before removing, list every way the symptom can come back, not only the library behavior the comment names; one workaround often covers more than its comment says. If the only proof is something the user has to see on a device, it stays a candidate.

**Report every workaround checked**: file and line, what it covers, keep / remove / could not tell, and the evidence (issue state and fixing release, changelog entry, what the removal test showed). Proven removals go in their own commit on top of the bump, never inside the bump commit, so either can be reverted alone; remove the comment and update or delete the memory note with the code. Candidates that were not proven are reported and left in place. Say "no workarounds to retire" when that is the answer, and which packages were checked.

## Other manifests: protocol/ and rnmodules/react-native-kb/

Dependabot also watches `protocol/yarn.lock` and `rnmodules/react-native-kb/yarn.lock`. Cover them on each pass — the same scripts work there (`check-outdated.py` reads the cwd's `package.json` and skips `file:`/`link:`/`github:` deps automatically).

### protocol/

- Direct deps are tiny; the real tree comes from `avdl-compiler` (pinned to `github:keybase/node-avdl-compiler#master`), which exact-pins transitives (e.g. `lodash "4.17.15"`) — LOCKFILE deletion can't help, so vulnerable transitives need `resolutions`. Current block: `"**/lodash"`, `"**/underscore"` (underscore is pulled via jison → nomnom, which pins `1.1.x`).
- **Verify** any forced bump by running the codegen end-to-end: `cd protocol && make clean && make` must exit 0 AND leave `git status` clean outside `protocol/package.json`+`yarn.lock` — the generated output (json/, go/protocol/, shared TS) must be byte-identical.

### rnmodules/react-native-kb/

- Only one real (non-`file:`) devDep: `react-native-builder-bob`. Bob ≥0.43 validates entry fields with `require.resolve`, which needs an explicit extension — that's why `"main"` is `"src/index.tsx"` (not `"src/index"`); don't "clean it up" back to extensionless or the `prepare` script (`bob build`) fails with `Found incorrect path in 'main' field`. The `"react-native"`/`"source"` fields stay extensionless for metro.
- Bob's tsc run uses the module's own `tsconfig.json` — keep it free of TS-6-deprecated options (no `baseUrl`, `moduleResolution: "bundler"`).
- The app consumes the module's `src/` directly via the `file:` dep + postinstall sync; bob's `lib/` output is gitignored and unused. After changing the module's `package.json`, run `yarn sync:kb-modules` from `shared/` then `yarn lint:all`.
- Everything vulnerable here is transitive dev tooling (babel/metro chain). Fix by deleting the vulnerable entry blocks from `yarn.lock` and re-running `yarn` — the ranges are loose (`^`), so they re-resolve to patched versions with no `package.json` change.

### Go modules — out of scope

Dependabot also flags `go/go.mod` and `packaging/**/go.mod`. Don't touch them on a deps pass, even for patch bumps. List those alerts in the report as not addressed. (`yarn audit` only covers npm; read the full alert list with `gh api repos/keybase/client/dependabot/alerts -f state=open`, read-only.)

### go/chat/flip/

Has a `package.json` solely so `make` can `npm i` the avdl compiler for one-off codegen. Its `package-lock.json` was deliberately deleted (2026-07) to kill stale dependabot alerts — don't recreate it; if `npm i` regenerates one during codegen, don't commit it.

## Notes

- `lodash` types (`@types/lodash`, `@types/lodash-es`) can be updated independently of lodash itself.
- **Always bump `@types/react` to the latest patch the script finds, even if runtime `react` is unchanged.** DefinitelyTyped ships type-only patches independent of the react runtime version. When you bump it, update the `resolutions` entry (`**/@types/react`) to the SAME version — multiple installed copies of `@types/react` cause type conflicts.
- `@types/react-dom`, `@types/react-is` should stay in sync with their runtime counterparts — update only if the runtime version changed.
- Packages with versions matching the `expo` SDK pattern (e.g., `56.x.x`) are `expo-*` packages and can be updated together.
- **`@react-navigation/core` must track what `@react-navigation/native` actually resolves**, not just the surface number of the other nav packages. `@react-navigation/native` (alpha.24) and `@react-navigation/core` (alpha.15/alpha.16) use different numbering — they are NOT in sync by design. Always check-outdated on `@react-navigation/core` and accept upgrades the script finds, even if the number looks unrelated to the other nav alpha versions. Skipping this causes duplicate installs and React context identity mismatches at runtime.
