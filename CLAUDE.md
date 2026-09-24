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
- After editing `rnmodules/react-native-kb/`: run `yarn sync:kb-modules` before building. `shared/node_modules/react-native-kb` is a copy, not a symlink, and Xcode compiles the copy — skipping this builds stale sources and reports errors against code you already fixed. `rnmodules/kb-common/` needs no sync (the Podfile references it by path).
- After editing `protocol/avdl/` or `protocol/bin/enabled-calls.json`: from `protocol/`, run `node ./bin/generate-ts.ts && cp ./js/rpc*.tsx ../shared/constants/rpc` and commit the regenerated `shared/constants/rpc/rpc-gen.tsx`.
- Never hand-edit generated code (rpc-gen, protocol output, mocks, codegen'd files of any kind). Edit the source it's generated from and rerun the generator. CI regenerates and fails on any diff.
- When updating `electron`: run `shared/desktop/extract-electron-shasums.sh <version>`.
- Keep an open PR's description in step with its branch. Whenever new commits change what the PR does or how (a new fix, a changed approach, a removed piece, new tests or evidence), rewrite the affected sections with `gh pr edit --body-file`, and the title if the scope moved. It should read as a description of the current diff, not a changelog. Skip it for commits that don't change the story (lint, renames, test placeholders).
- Never patch `react-native` itself (patch-package or node_modules edits): we use prebuilt RN core and don't compile its source, so native-side patches never take effect. Work around RN core bugs in app code.

## Working Directory
Repo root is `client/`. TS source lives in `shared/`. Always use absolute paths for file ops. For Bash: always `cd shared/` first.

## Superpowers
- Plans created by superpowers skills go into `plans/` at the repo root.
- Never commit plan/spec/design docs. They're scratch for the current effort — leave them untracked and delete them when the work lands.

## Validation
After TS changes (from `shared/`): `yarn lint:all` (= `yarn lint` && `yarn lint:bailouts` && `yarn tsc`). Plain `yarn lint` is eslint only and does NOT catch react-compiler bailouts — no compiler rule is wired into `eslint.config.mjs`, so bailouts only surface via `lint:bailouts`. `lint:bailouts` also flags components the compiler cannot name (an `isMobile ? arrow : arrow` ternary is never compiled at all, so nothing in it is memoized — name both branches instead), and memo scopes keyed on the whole props object (a `props.x` read inside a callback, or a destructure below one, makes the compiler key on `props` itself, so the cache never hits — read every prop through one destructure at the top, above every callback). Repo baseline is 0 bailouts and 0 whole-props deps; keep it there. When debugging visually, skip until fix is confirmed. Never delete the ESLint cache.

Before reporting any TS change complete: run `yarn lint:all` and get it clean. Do NOT run `/code-review` while iterating, building, testing, or debugging — only once the change is about to be pushed (commit for a PR, push, or open a PR). At that point, if the diff has real logic in it, run `/code-review high` against the diff and fix what it finds; if a finding is wrong, say why instead of applying it. Skip the review for trivial diffs (a config/JSON line, a codegen resync, a typo) and say you skipped it.
