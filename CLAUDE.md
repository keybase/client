## Rules
- No `Co-Authored-By` in commits. Ever.
- "Was working before" = base branch (`nojima/HOTPOT-next-670-clean` or `master`), not previous commit.
- Never use `npm`. Always `yarn`.
- Never silently drop features/behavior — ask first, present options.
- No DOM elements (`<div>`, `<span>`, etc.) in plain `.tsx` files — use `Kb.*`. Guard desktop-only DOM with `Styles.isMobile`.
- Temp files go in `/tmp/`.
- Remove unused code when editing: styles, imports, vars, params, dead helpers.
- Comments: no refactoring notes; only add when context isn't obvious from code.
- Exact versions in `package.json` (no `^`/`~`).
- Keep `react`, `react-dom`, `react-native`, `@react-native/*` in sync with Expo SDK.
- When updating deps: edit `package.json` → `yarn` → `yarn pod-install`.
- When updating `electron`: run `shared/desktop/extract-electron-shasums.sh <version>`.

## Working Directory
Repo root is `client/`. TS source lives in `shared/`. Always use absolute paths for file ops. For Bash: always `cd shared/` first.

## Validation
After TS changes (from `shared/`): `yarn lint` then `yarn tsc`. When debugging visually, skip until fix is confirmed. Never delete the ESLint cache.
