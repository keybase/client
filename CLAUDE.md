## Rules
- No `Co-Authored-By` in commits. Ever.
- Never interact with the Electron app or iOS simulator (screenshots, driving UI, debug ports) without asking first. The user drives and takes screenshots.
- Use `--no-ext-diff` with `git diff` (and `git show`/`git log -p`) so external diff tools don't hijack output.
- "Was working before" = base branch, not previous commit. Base branch is almost always `nojima/HOTPOT-next-670-clean-2` (not `master`). Always run `gh pr view --json baseRefName` to confirm before any `git diff` or `git log` comparison.
- Never use `npm`. Always `yarn`.
- Never silently drop features/behavior — ask first, present options.
- In tests/stories, use `testuser` / `testuser-mac` as placeholder usernames — never real usernames like `chrisnojima`.
- No DOM elements (`<div>`, `<span>`, etc.) in plain `.tsx` files — use `Kb.*`. Guard desktop-only DOM with `Styles.isMobile`.
- Temp files go in `/tmp/`.
- Remove unused code when editing: styles, imports, vars, params, dead helpers.
- Comments: no refactoring notes; only add when context isn't obvious from code.
- Exact versions in `package.json` (no `^`/`~`).
- Keep `react`, `react-dom`, `react-native`, `@react-native/*` in sync with Expo SDK.
- When updating deps: edit `package.json` → `yarn` → `yarn ios:pod:install`.
- When updating `electron`: run `shared/desktop/extract-electron-shasums.sh <version>`.

## Working Directory
Repo root is `client/`. TS source lives in `shared/`. Always use absolute paths for file ops. For Bash: always `cd shared/` first.

## Superpowers
- Plans created by superpowers skills go into `plans/` at the repo root.

## Validation
After TS changes (from `shared/`): `yarn lint` then `yarn tsc`. When debugging visually, skip until fix is confirmed. Never delete the ESLint cache.
