---
name: keybase-e2e-tests
description: Use when writing, fixing, or adding e2e flow tests for the Keybase app — desktop (Playwright) or iOS (Maestro). Covers testID conventions, navigation patterns, common pitfalls, and the two-harness structure.
---

# Keybase E2E Flow Tests

## Overview

Two harnesses, one shared testID registry. Always implement Electron + iOS for each bucket together (pairing rule in `plans/flow-test.md`).

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

## iOS — Appium + WebdriverIO (TypeScript)

| What | Where |
|------|-------|
| Flow files | `shared/tests/e2e/ios-appium/flows/*.test.ts` |
| Helpers | `shared/tests/e2e/ios-appium/helpers/` (elements, navigate, app) |
| Aggregate spec | `shared/tests/e2e/ios-appium/all.test.ts` (imports all flows → ONE session) |
| Config | `shared/tests/e2e/ios-appium/wdio.conf.ts` |
| Run all | `KB_SMOKE_USER=<user> yarn test:e2e:ios` (booted sim + installed app) |
| Report | `yarn test:e2e:ios:report` |

Drives the **already-installed** app black-box (no rebuild). Selectors: `~<testID>` (testID → iOS accessibilityIdentifier). Helpers: `el/els/waitForTestID/countTestID/byText/tab` (elements), `escapeToTabs/goBack/navigateTo*/scrollDownToText` (navigate). `escapeToTabs` runs before every test (resets to the tab root).

**Gotchas (hard-won — read before adding flows):**
- **Native tab bar:** tap tabs by **label** (`tab('People')` → `~People`), NOT `nav-tab-*` testIDs — those don't reach the native `UITabBar`.
- **Container testIDs** (a flex `Kb.Box2` wrapping a list) report `visible="false"` to XCUITest even when on screen → use `waitForTestID` (it uses `waitForExist`, presence), never `toBeDisplayed`.
- **testIDs must be on the MOBILE-rendered element.** Many components branch on `isMobile`/`.desktop`/`.native`; a desktop-only testID is invisible on iOS (see [[project_e2e_testid_mobile_branch]]). Put the testID on the **clickable/leaf** element (e.g. `Kb.ListItem`'s `testID`, a `ClickableBox`), not a non-clickable wrapping `Box2` — wdio `.click()` no-ops on a non-accessible container.
- **`byText` uses CONTAINS** — tappable rows have merged accessibility labels (e.g. `", Crypto"`), so exact match fails.
- **`Kb.Tabs`** supports a per-tab `testID` (needed for icon-only tabs like the team Settings gear). The app remembers the last-selected team tab → select tabs by testID, don't assume the default.
- **Modals:** dismiss via Done/Close/Cancel (`escapeToTabs` does this first, before back buttons — a modal's back button is a no-op that loops).
- **HMR applies testID/component changes** to the running sim app — no manual reload needed when adding testIDs.
- Wait for a **real data row** (not just the list container) before asserting/screenshotting, so shots show loaded content.

**iOS tab structure:** People & Teams are direct tabs; Chat & Files have their own nav helpers; Crypto/Devices/Git/Settings live under the **More** tab (`navigateToMore`).

## Plan

`plans/flow-test.md` — bucket checklist ordered easiest-first. Work one bucket at a time, both platforms together.
