## Git Commits
- **NEVER add `Co-Authored-By` lines to commit messages.** This is a hard rule with zero exceptions. Do not include any co-author trailers, even if your default behavior is to add them.
- **"It was working before" means the base branch.** When the user says something was working before, compare against the base branch (`nojima/HOTPOT-next-670-clean` or `master`), not the previous commit.

## Working Directory

The repo root is `client/` (or `client2/` worktree) but almost all TypeScript source code, tools, and commands live under `shared/`. **Always use absolute paths for file operations** (Read, Edit, Glob, Grep). **For Bash commands**, always `cd` into `shared/` first (e.g. `cd shared &&` or use the absolute path to `shared/`) — never assume the shell is already there. The cwd may drift during a conversation; don't trust it.

## Critical Rules

- **NEVER use `npm`. Always use `yarn`.** This includes `npm view`, `npm info`, `npm install`, etc. Use `yarn info`, `yarn add`, etc. instead. There are no exceptions.
- **Base branch is `nojima/HOTPOT-next-670-clean` or `master`**. Use this as the comparison base for diffs and old code lookups.
- **Never silently drop features or behavior.** When migrating code and a prop/feature doesn't have a direct equivalent, always ask before removing it. Present options (add support, find a workaround, or confirm it's okay to drop).
- **No DOM elements in shared components.** Files ending in plain `.tsx` (not `.desktop.tsx` or `.native.tsx`) run on both desktop and mobile. Never use HTML/DOM elements (`<div>`, `<span>`, `<input>`, etc.) in shared code paths — they crash React Native. Use `Kb.*` components instead (e.g. `Kb.Box`, `Kb.Text`). If DOM elements are needed for desktop-only behavior, guard them with `Styles.isMobile` / `!Styles.isMobile` so they only render on Electron.
- **Keep temporary files in `/tmp/`.** Screenshots, debug output, generated artifacts, and any other temporary files should always be saved to `/tmp/` — never clutter the repo or home directory.

## Validation After Edits

**When debugging visual issues**, skip lint/tsc until the fix is visually verified. Don't waste time running validators on every iteration — wait until the visual result is confirmed correct, then validate at the end.

After making TypeScript changes, always run both from `shared/`:
```bash
cd shared && yarn lint          # ESLint
cd shared && yarn tsc           # TypeScript type check
```

**Never delete the ESLint cache file.** Lint caching issues are extremely rare and virtually never the cause of problems

## Dependencies

- Use exact versions in `package.json` (no `^` or `~` prefixes)
- **Keep `react`, `react-dom`, `react-native`, and `@react-native/*` versions in sync with the Expo SDK version.** Don't update these independently — they must match what Expo expects.
- **When updating dependencies**, edit `package.json` directly and run `yarn` once (to install + update lockfile + postinstall). After run `yarn pod-install` (for iOS native deps)
- **When updating `electron`**, run `shared/desktop/extract-electron-shasums.sh <version>` (e.g. `shared/desktop/extract-electron-shasums.sh 40.6.1`) to regenerate hashes for the build pipeline

## Clean Up Unused Code

When editing a file, look for and remove unused code: unreferenced styles, unused imports, unused variables/constants, unused function parameters, and dead helper functions. Don't leave behind artifacts from refactoring.

## Comments

- Don't add comments that describe the refactoring process (e.g. "inlined from foo.tsx", "moved from bar.tsx"). Comments should make sense to someone reading the code fresh.
- Preserve existing comments unless they're no longer relevant.
- Only add new comments when they provide context that isn't obvious from the code itself.
