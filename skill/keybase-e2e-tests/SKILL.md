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

## iOS — Maestro

| What | Where |
|------|-------|
| Flow files | `shared/.maestro/e2e/flows/*.yaml` |
| Subflows | `shared/.maestro/e2e/subflows/` |
| Config | `shared/.maestro/e2e/config.yaml` (60 s timeout) |
| Run all | `yarn test:e2e:ios` |
| Run branch | `yarn test:e2e:ios:branch` |

**iOS tab structure:**
- Direct tabs: **People**, **Teams**
- Via Teams first: **Chat**, **Files** (both also appear in More menu — tap Teams first to avoid ambiguity)
- **More** tab contains: Crypto, Devices, Git, Settings, and settings sub-pages

**Subflow — escape-to-tabs:** Taps backButton up to 4 times to reset any open screen back to the tab bar. Always run at the start of each flow.

**Maestro command patterns:**
```yaml
appId: keybase.ios
---
- runFlow: ../subflows/escape-to-tabs.yaml
- tapOn:
    text: "Teams"           # navigate past ambiguous tabs first
- tapOn:
    text: "Files"
- extendedWaitUntil:
    visible:
      id: "files-browser"   # testID value (not the constant name)
    timeout: 3000
- takeScreenshot: tests/results/ios-debug/flow-name-step
- runFlow:
    when:
      visible:
        id: "some-id"       # conditional block — skip gracefully if no data
    commands:
      - tapOn:
          id: "some-id"
          index: 0
```

## Plan

`plans/flow-test.md` — bucket checklist ordered easiest-first. Work one bucket at a time, both platforms together.
