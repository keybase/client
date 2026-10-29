---
name: keybase-e2e-tests
description: Use when writing, fixing, or adding e2e flow tests for the Keybase app — desktop (Playwright) or iOS (Appium + WebdriverIO). Covers testID conventions, navigation patterns, common pitfalls, and the two-harness structure.
---

# Keybase E2E Flow Tests

## Overview

Two harnesses, one shared testID registry. Implement each flow on Electron and iOS together.

## Shared testID Registry

`shared/tests/e2e/shared/test-ids.ts` — single source of truth for all `testID` values.

**Adding a testID to a component:**
```tsx
import * as TestIDs from '@/tests/e2e/shared/test-ids'
// ...
<Kb.ScrollView testID={TestIDs.SETTINGS_ADVANCED}>
```

**Rule:** Add `testID` prop to an **already-existing** element (input, scroll view, pre-existing wrapper). Never add a new container just to attach a testID.

## Desktop — Playwright

| What | Where |
|------|-------|
| Test files | `shared/tests/e2e/electron/flows/*.test.ts` |
| Nav helpers | `shared/tests/e2e/electron/helpers/navigate.ts` |
| Run all | `yarn test:e2e:desktop` |
| Run branch | `yarn test:e2e:desktop:branch` |

**Navigation helpers:** `navigateToChat`, `navigateToFiles`, `navigateToTeams`, `navigateToGit`, `navigateToSettings`, `navigateToPeople`, `navigateToCrypto`, `navigateToDevices`

**Common pitfall — hidden nav stack elements:** React Navigation keeps prior screens mounted but hidden. `getByTestId(X)` may match 2+ elements (one hidden, one visible), causing Playwright strict-mode failures. Fix: use a selector unique to the destination screen rather than one shared with the source screen. Example: after navigating into a Files subfolder, the root screen's `files-browser` is still in the DOM but hidden — check for the Filter textbox instead, which only exists in subfolder views.

## Desktop release gate

`yarn test:e2e:desktop:release` (from `shared/`, about 45 min) runs everything and exits 1 on any failure, a flaky or skipped flow test included (retries stay at 1, so a flake shows as `flaky: <test>`).

- **Env:** accounts come from `~/.config/keybase-e2e/env` (mode 600, its dir 700; `yarn test:e2e:accounts:setup` fills in the peers); the environment wins over the file, and the run hands its children the account names (never paper keys). The main service must already be signed in as `KB_SMOKE_USER` (every flow test checks it again before it runs), and KBFS must answer `keybase fs ls /keybase/private/$KB_SMOKE_USER`; the FUSE mount itself is manual-only. The command never switches, stops or starts the main service or its components, and refuses with the command to run instead.
- **Peers:** the other accounts run in their own `keybase --home` services; the command starts them if they are down and leaves them running.
- **Phases:** preflight (release lock `/tmp/kb-e2e-release.lock`, one run at a time; account, ports 4000/9222, visual gate lock, an unlocked macOS session (a locked one refuses the window the native fullscreen the video flows need, so keep it unlocked for the whole run), KBFS, peers, `accounts:setup --check`) → launch the app → sweep leftovers once → `electron-flows` (light only) → relaunch with `--visual` and `visual:render` → census → report. It stops the app it launched at the end or on Ctrl-C.
- **Outputs** (`shared/tests/results/`): `electron-report.html` (flows, then tour entries, failures first), `census.md` (routes, windows and write RPCs no run reached; the windows besides the main one are listed by hand in `tests/e2e/electron/census-windows.ts` and credited by their `window/*` tour entries), `manual-checklist.md` (what to do by hand), `watchdog.log` (written only when the renderer went blank, which fails the run), plus one summary line per phase and a macOS notification.
- **Known failures:** `tests/e2e/electron/known-failures.ts` lists failures seen on master with their cause. They still fail the run; the report labels them "known on master", and says "now passes — remove it" when one passes.
- **Knobs:** `KB_E2E_RELEASE_ONLY=<grep>` runs only matching flows and the `settings/*` tour entries (to try the command; the census then reports gaps), `KB_E2E_RELEASE_TIMEOUT_MIN` (default 150), `KB_E2E_NO_OPEN=1`.

## Desktop flow rules

**Running while you change things:** run one test at a time with `yarn test:e2e:desktop:flows <file> --grep '<title>'`, once. Use `--repeat-each=N --retries=0` only on the ONE test whose flake fix you are proving. The full release runs at the end of a change, never between edits. A test stuck for more than about 5 minutes without clear progress gets reported with evidence, not dug into.

**Accounts and names:** every flow runs on the test accounts from `~/.config/keybase-e2e/env` (`loadE2EEnv()` / `loadE2EAccounts()`). Never put an account, team, password or paper key in the repo, a step name, an error or a log line. Team writes go only in `KB_E2E_TEAM` or a stamped subteam. Rows are found by exact name (`inboxRow(page, title)`, `openE2ETeam`, `openE2EChannel`), never "first row".

**Stamped names:** everything a flow creates carries the run id (`e2eRunId()`, `accounts/run-id.ts`), so the sweeper can find what a run left behind:
- channels, repos, emails, KBFS entries, devices: `stampedChannelName(label, runId)` → `e2e-<runid>-<label>`, label `[A-Za-z0-9_-]`. Emails are `e2e-<runid>-<label>@example.com`.
- message bodies and titles: `` `e2e-${e2eRunId()}-…` ``.
- teams: `stampedTeamName(label, runId)` → `e2e<runid><label>`, label `[a-z0-9_]` with no double underscore.
- emoji: `stampedEmojiName(label, runId)` → `e2e_<runid>_<label>`, label `[a-z0-9]`. An alias the service renames on a clash (a `#N` suffix) is no longer recognised as stamped, so pick labels unique within the run.
- a new kind of object needs a sweep rule in `accounts/sweep-lib.ts` too. `yarn test:e2e:accounts:sweep --dry-run` right after a run may list only that run's stamped chat messages (flows leave what they post for the next sweep, which deletes them by run stamp); anything else it lists, from that run or older, is a failure: every other object a flow makes it removes itself.

**Helpers** (`tests/e2e/electron/helpers/`, `tests/e2e/shared/`):
- `asSecond(page, f)` runs `f` with the app (and so the main service) switched to the second account through the account switcher, and switches back whether `f` passed or threw. `signedOutThenBack(page, f)` runs `f` on the login screen and signs smoke back in. `restoreToSmoke(page)` is the recovery both use. Any flow that switches accounts or signs out must end on smoke (`requireMainIsSmoke`).
- `dropFiles(page, target, paths)` drops real files onto an element; `pasteFiles` pastes an image (the main process's clipboard read is stubbed). Use `dropFiles` or Playwright's `filechooser` event for avatar and emoji pickers: they open a Chromium file chooser, not an Electron dialog.
- `connectMainProcess()` reaches the Electron main process through its Node inspector: `stubOpenDialog` / `stubSaveDialog`, `recordNotifications` / `takeNotifications`, `openUrl` (a `keybase://` link as the OS hands it), `recordExternalUrls` / `takeExternalUrls` (stubs `shell.openExternal`), `clipboardText`, `dropServiceSocket` (callers assert the count is above 0). Every stub in the main process, whoever left it, is restored after each test and before the inspector closes.
- `openRemoteWindow(context, main, name, props)` opens a remote window (menubar, tracker, pinentry, unlock-folders) and returns its page once its props have rendered; close it with `closeRemoteWindow`.
- `expectPersists(page, read, expected, what)` reloads the renderer, then `read` navigates back and reads the value. Use it for every "survives a reload" claim.
- `mainRpc(method, arg)` sends one RPC to the main service after checking it is on smoke; `mainRpcAsSecond` the same inside `asSecond`. They are for setup, read-backs and restores only.
- `CORPUS` / `TEXT_CORPUS` (`tests/e2e/fixtures/corpus/corpus.ts`) are the checked-in files and texts flows attach, drop and paste; `bigFile(runId)` makes a 50MB random file under `/tmp/kb-e2e`.
- `openMenu(page, trigger, item, what)` opens every popup menu: the popup drops a show or hide within 100ms of its last one, so it waits that out, clicks once, fails if the menu does not open, and waits it out again before the pick. Any other show or hide right after one (an outside click to close) goes after `waitOutPopupDebounce(page)`.
- `retriedNavigation(what, attempt, opts)` is the only retry loop for getting somewhere (a list that redraws under the click, a search slow to find something new); it puts the try count on the test as a `retried` annotation. An asserted action is never retried: wait for its precondition (`waitSteady(locator, what)` for a row that must stop being replaced, `waitEnabledSteady(button, what)` for a button whose inputs reload) and press once.
- `step(...)` at every state change; `manualEdge(page, testInfo, id)` where a person takes over (the id is a `MANUAL_ONLY` entry in `manual-only.ts`).

**Coverage counts only from the app's UI.** Setup and read-back through the CLI, the peers or `mainRpc` are fine, but a census item is closed only when the app sends it. Every new write RPC in `protocol/bin/enabled-calls.json`, route or window needs a flow (or a tour entry, for routes and windows) or an entry in `census-exclusions.ts` with a real reason (`manual-only: <id>` names a `MANUAL_ONLY` entry). The census fails on an exclusion that is no longer needed, so remove it once a flow covers the item.

**Assertions:** check the outcome (the row, the setting after a reload, a CLI or peer read-back), never only "the modal opened". A flow that changes a setting reads it first and restores it in `finally`; a failed restore fails the test. No silent skips (`test.skip`, conditional early returns): missing setup fails and names what is missing. No blind retries, longer sleeps or soft-passes: retries stay at 1 and a flaky test counts as a failure, so find the cause.

**Known failures:** a deterministic app or service bug on master gets a strict test of the default user path that fails, plus an entry in `known-failures.ts` keyed `<file> › <describe…> › <title>` with its cause. The run still fails, and the report labels it "known" (check that it does: a key that does not match shows as a new failure). When the bug is fixed the report says "known now passes" and the entry is removed. A route-around for the rest of the coverage is a separate test, never a replacement. A strict failing test never goes in a serial describe: its failure and retry would rerun or taint the rest of the group.

**Secrets:** a password, paper key or provisioning phrase is typed only through `submitSecret` / `secret-input.ts`, which type through the main process and read back lengths only, so no Playwright action, assertion, trace or failure snapshot ever holds the value. A file that types a secret sets `test.describe.configure({retries: 0})` and `test.use({trace: 'off'})`. The secret-scan reporter (`secret-scan-reporter.ts`, and the release's secrets phase) scans every artifact for the env file's secrets, every second-account password the env file held during the run included (the start value, a `KB_SECOND_PASSWORD_NEXT`, the promoted one; kept in memory only), deletes any file that holds one and fails the run. `insertSecret` types only into a focused element matching its selector.

**The second account's password** is the harness's own: `KB_SECOND_PASSWORD` in the env file, a random value set by `yarn test:e2e:accounts:second-password`. Read it only with `requireSecondPassword`. A change goes through `rotateSecondPassword`: the new value is written as `KB_SECOND_PASSWORD_NEXT` first, then set, then `checkSecondSecretSurvives` (repaired once with `repairSecondSecret` on failure) and only then promoted. A leftover `KB_SECOND_PASSWORD_NEXT` stops every password flow until the owner checks which value the server holds; never edit the env file by hand. After a file signs second in through the app, or does anything as second that can drop its stored secret, its `afterAll` runs `checkOrRepairSecondSecret(env, requireSecondPassword(env), appRepairDeps(_electronPage))` and its `afterEach` runs `restoreToSmoke`. Such a file holds only those tests, so the rest of its area keeps traces and retries. The smoke account's password is never touched.

**Paper keys and devices:** a paper key a flow makes is recorded in the paper-key ledger (`accounts/paper-key-ledger.ts`: run id, device id and name, never the words) with `recordPaperKey`, and removed with `forgetPaperKey` once revoked; the sweeper revokes only ledger entries. A provisioned device is a new peer home `homes/prov-<runid>` with the file secret store, stopped with `ctl stop --shutdown` before it is revoked. Nothing provisions the main service.

## iOS — Appium + WebdriverIO (TypeScript)

| What | Where |
|------|-------|
| Flow files | `shared/tests/e2e/ios-appium/flows/*.test.ts` |
| Helpers | `shared/tests/e2e/ios-appium/helpers/` (elements, navigate, app) |
| Aggregate spec | `shared/tests/e2e/ios-appium/all.test.ts` (imports all flows → ONE session) |
| Config | `shared/tests/e2e/ios-appium/wdio.conf.ts` |
| Run both devices | `KB_SMOKE_USER=<user> yarn test:e2e:ios` (iPhoneTest + iPadTest in PARALLEL; app installed on both) |
| Run one device | `KB_SMOKE_USER=<user> yarn test:e2e:ios:iphone` / `yarn test:e2e:ios:ipad` (serial runner, shuts down other sims) |
| Report | `yarn test:e2e:ios:report` (reads ONLY `tests/results/ios-appium-debug-{iphone,ipad}`; each run overwrites its device's dir; per-image timestamps show when each device last ran) |

Drives the **already-installed** app black-box (no rebuild). Selectors: `~<testID>` (testID → iOS accessibilityIdentifier). Helpers: `el/els/waitForTestID/byText/tab` (elements), `escapeToTabs/goBack/navigateTo*/scrollDownToText` (navigate). `escapeToTabs` runs before every test (resets to the tab root).

**Gotchas (hard-won — read before adding flows):**
- **Native tab bar:** tap tabs by **label** (`tab('People')` → `~People`), NOT `nav-tab-*` testIDs — those don't reach the native `UITabBar`.
- **Container testIDs** (a flex `Kb.Box2` wrapping a list) report `visible="false"` to XCUITest even when on screen → use `waitForTestID` (it uses `waitForExist`, presence), never `toBeDisplayed`.
- **testIDs must be on the MOBILE-rendered element.** Many components branch on `isMobile`/`.desktop`/`.native`; a desktop-only testID is invisible on iOS, so a flow that waits on it passes on desktop while testing nothing on iOS. Put the testID on the **clickable/leaf** element (e.g. `Kb.ListItem`'s `testID`, a `ClickableBox`), not a non-clickable wrapping `Box2` — wdio `.click()` no-ops on a non-accessible container.
- **`byText` uses CONTAINS** — tappable rows have merged accessibility labels (e.g. `", Crypto"`), so exact match fails.
- **`Kb.Tabs`** supports a per-tab `testID` (needed for icon-only tabs like the team Settings gear). The app remembers the last-selected team tab → select tabs by testID, don't assume the default.
- **Modals:** dismiss via Done/Close/Cancel (`escapeToTabs` does this first, before back buttons — a modal's back button is a no-op that loops).
- **HMR applies testID/component changes** to the running sim app — no manual reload needed when adding testIDs.
- Wait for a **real data row** (not just the list container) before asserting/screenshotting, so shots show loaded content.

**iOS tab structure:** People & Teams are direct tabs; Chat & Files have their own nav helpers; Crypto/Devices/Git/Settings live under the **More** tab (`navigateToMore`).
