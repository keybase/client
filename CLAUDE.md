## Rules
- No `Co-Authored-By` in commits. Ever.
- Never interact with the Electron app or iOS simulator (screenshots, driving UI, debug ports) without asking first. The user drives and takes screenshots.
- Use `--no-ext-diff` with `git diff` (and `git show`/`git log -p`) so external diff tools don't hijack output.
- "Was working before" = base branch, not previous commit. Base is normally `master`. Always run `gh pr view --json baseRefName` to confirm before any `git diff` or `git log` comparison.
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
- Never patch `react-native` itself (patch-package or node_modules edits): we use prebuilt RN core and don't compile its source, so native-side patches never take effect. Work around RN core bugs in app code.

## Working Directory
Repo root is `client/`. TS source lives in `shared/`. Always use absolute paths for file ops. For Bash: always `cd shared/` first.

## Superpowers
- Plans created by superpowers skills go into `plans/` at the repo root.

## Validation
After Go changes (from `go/`): always run both the tests for every package you touched (`go test ./chat/... ./libkb/...` etc.) and the linter (`golangci-lint run --timeout 30m ./...`, same as `make golangci-lint`). CI runs golangci-lint with `--new-from-rev <base>` and gosec/govet/revive/staticcheck are enabled — nothing else in the repo (no pre-commit hook, not `yarn lint:all`) runs it for you, so a skipped lint pass = red CI.

After TS changes (from `shared/`): `yarn lint:all` (= `yarn lint` && `yarn lint:bailouts` && `yarn tsc`). Plain `yarn lint` is eslint only and does NOT catch react-compiler bailouts — no compiler rule is wired into `eslint.config.mjs`, so bailouts only surface via `lint:bailouts`. Repo baseline is 0 bailouts; keep it there. When debugging visually, skip until fix is confirmed. Never delete the ESLint cache.
