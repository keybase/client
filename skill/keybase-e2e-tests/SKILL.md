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

`yarn test:e2e:desktop:release` (from `shared/`, ~30-40 min) runs everything and exits 1 on any failure, a flaky or skipped flow test included (retries stay at 1, so a flake shows as `flaky: <test>`).

- **Env:** accounts come from `~/.config/keybase-e2e/env` (mode 600, its dir 700; `yarn test:e2e:accounts:setup` fills in the peers); the environment wins over the file, and the run hands its children the account names (never paper keys). The main service must already be signed in as `KB_SMOKE_USER` (every flow test checks it again before it runs), and KBFS must answer `keybase fs ls /keybase/private/$KB_SMOKE_USER`; the FUSE mount itself is manual-only. The command never switches, stops or starts the main service or its components, and refuses with the command to run instead.
- **Peers:** the other accounts run in their own `keybase --home` services; the command starts them if they are down and leaves them running.
- **Phases:** preflight (release lock `/tmp/kb-e2e-release.lock`, one run at a time; account, ports 4000/9222, visual gate lock, KBFS, peers, `accounts:setup --check`) → launch the app → sweep leftovers once → `electron-flows` (light only) → relaunch with `--visual` and `visual:render` → census → report. It stops the app it launched at the end or on Ctrl-C.
- **Outputs** (`shared/tests/results/`): `electron-report.html` (flows, then tour entries, failures first), `census.md` (routes, windows and write RPCs no run reached; the windows besides the main one are listed by hand in `tests/e2e/electron/census-windows.ts` and credited by their `window/*` tour entries), `manual-checklist.md` (what to do by hand), `watchdog.log` (written only when the renderer went blank, which fails the run), plus one summary line per phase and a macOS notification.
- **Known failures:** `tests/e2e/electron/known-failures.ts` lists failures seen on master with their cause. They still fail the run; the report labels them "known on master", and says "now passes — remove it" when one passes.
- **Knobs:** `KB_E2E_RELEASE_ONLY=<grep>` runs only matching flows and the `settings/*` tour entries (to try the command; the census then reports gaps), `KB_E2E_RELEASE_TIMEOUT_MIN` (default 150), `KB_E2E_NO_OPEN=1`.

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
