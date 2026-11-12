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
- Never add a new dependency (npm package, pod, Go module, etc.) unless the user explicitly approves it.
- Exact versions in `package.json` (no `^`/`~`).
- Keep `react`, `react-dom`, `react-native`, `@react-native/*` in sync with Expo SDK.
- When updating deps: edit `package.json` → `yarn` → `yarn ios:pod:install`.
- After editing `rnmodules/react-native-kb/`: run `yarn sync:kb-modules` before building. `shared/node_modules/react-native-kb` is a copy, not a symlink, and Xcode compiles the copy — skipping this builds stale sources and reports errors against code you already fixed. `rnmodules/kb-common/` needs no sync (the Podfile references it by path).
- After editing `protocol/avdl/` or `protocol/bin/enabled-calls.json`: from `protocol/`, run `node ./bin/generate-ts.ts && cp ./js/rpc*.tsx ../shared/constants/rpc` and commit the regenerated `shared/constants/rpc/rpc-gen.tsx`.
- Never hand-edit generated code (rpc-gen, protocol output, mocks, codegen'd files of any kind). Edit the source it's generated from and rerun the generator. CI regenerates and fails on any diff.
- When updating `electron`: run `shared/desktop/extract-electron-shasums.sh <version>`.
- Keep an open PR's description in step with its branch. Whenever new commits change what the PR does or how (a new fix, a changed approach, a removed piece, new tests or evidence), rewrite the affected sections with `gh pr edit --body-file`, and the title if the scope moved. It should read as a description of the current diff, not a changelog. Skip it for commits that don't change the story (lint, renames, test placeholders).
- Every change inside a `shared/patches/*.patch` has an entry in `shared/patches/README.md` (why, upstream issue/PR and its state, when it can go, how to check). Add, update or delete the entry in the same commit that adds, changes or removes the hunk, then run `python3 ../.claude/skills/update-dependencies/find-workarounds.py --patches` from `shared/` and get it passing.
- Never patch `react-native` itself (patch-package or node_modules edits): we use prebuilt RN core and don't compile its source, so native-side patches never take effect. Work around RN core bugs in app code.

## Debugging
- Evidence before diagnosis: when the user reports seeing something, never answer "that can't happen" from reading code. Reproduce it or add logging first, and only then name a cause.
- For a user-reported runtime bug, check whether it reproduces on the base branch before blaming the current branch. (Lint, tsc and test failures after our changes are still ours.)
- Before calling code dead, search the whole repo (desktop, native, Go callers, string-built names), not one directory.
- Prefer fixes that keep underlying state truthful (e.g. a UI-level hold) over changing state semantics, unless asked.

## Tests run the real thing
- Unit tests exercise the real library and the real app modules. Never write a fake that models a library's behavior (its timing, events, focus, routing, layout) or stands in for one of our own hooks/stores. A test built on a model checks the model: it passes on fiction, and reviews and fixes then get built on it.
- Navigation: use `shared/test/navigation.tsx` (the app's tree on the real React Navigation core and the real `navigationRef`). Never `jest.mock('@react-navigation/...')` or `jest.mock('@/constants/router')`.
- Mock only true edges: native modules with no JS implementation, network/IO, the Go service (`test/fake-engine.ts`). Mock at the lowest layer, and never invent ordering, timing or state there.
- A claim about how a library behaves (from a review, a comment, or a fake) gets a probe against the real library before any code changes for it.

## Working Directory
Repo root is `client/`. TS source lives in `shared/`. Always use absolute paths for file ops. For Bash: always `cd shared/` first.

## Superpowers
- Plans created by superpowers skills go into `plans/` at the repo root.
- Never commit plan/spec/design docs. They're scratch for the current effort — leave them untracked and delete them when the work lands.

## Validation
After TS changes (from `shared/`): `yarn lint:all` (= `yarn lint` && `yarn lint:bailouts` && `yarn tsc`). Plain `yarn lint` is eslint only and does NOT catch react-compiler bailouts — no compiler rule is wired into `eslint.config.mjs`, so bailouts only surface via `lint:bailouts`. `lint:bailouts` also flags components the compiler cannot name (an `isMobile ? arrow : arrow` ternary is never compiled at all, so nothing in it is memoized — name both branches instead), and memo scopes keyed on the whole props object (a `props.x` read inside a callback, or a destructure below one, makes the compiler key on `props` itself, so the cache never hits — read every prop through one destructure at the top, above every callback). Repo baseline is 0 bailouts and 0 whole-props deps; keep it there. When debugging visually, skip until fix is confirmed. Never delete the ESLint cache.

Before reporting any TS change complete: run `yarn lint:all` and get it clean. Do NOT run `/code-review` while iterating, building, testing, or debugging — only once the change is about to be pushed (commit for a PR, push, or open a PR). At that point, first get both `yarn lint:all` and `yarn test:unit` passing — never review, push, or open a PR with either failing. Then, for any non-trivial PR, run all three reviews against the diff before it is pushed: `/code-review high` (correctness), `/security-review` (security), and a simplification pass (`/simplify`, or read-only review agents for a large stack: duplicated helpers, one-use machinery, dead code, oversized changes). Run each review in a fresh context, never inline in the session that wrote the code: spawn a new `general-purpose` Agent (not a fork) per review and give it only the branch/worktree path, the base ref (`gh pr view --json baseRefName`) and which review to run. Give it no summary of the change, no description of the fixes and no claim of what is safe, because a reviewer that is handed the author's story checks the story instead of the code. The correctness reviewer must also do one adversarial pass: for each `await`, timer, deferred callback or RPC the diff adds or reorders, ask what can change before it resumes (account switch, logout, the route/popup instance closed or reopened, unmount, a newer request superseding it) and whether the code still acts on the right instance. Fix what they find, then re-run lint and unit tests; if a finding is wrong, say why instead of applying it. Skip the reviews for trivial diffs (a config/JSON line, a codegen resync, a typo) and say you skipped them.
