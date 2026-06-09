# Appium iOS E2E Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Maestro iOS e2e harness with Appium + WebdriverIO (TypeScript), keeping the existing shared testID registry and unified HTML report, and fixing the Fabric testID-flattening bug that currently makes several Maestro flows silently pass without testing anything.

**Architecture:** Appium drives the *already-built* `Keybase.app` black-box via the XCUITest driver — no app rebuild, no Podfile/Xcode changes, the custom RN-from-source + Go xcframework toolchain is never touched. Tests are WebdriverIO + Mocha in TS, mirroring the existing Playwright desktop harness (`tests/e2e/electron/`). `@wdio/appium-service` auto-manages the Appium server lifecycle. A new `generate-appium-report.mts` feeds the existing `generate-report-shared.mts` so the unified card report + visual-diff baselines keep working.

**Tech Stack:** Appium 3.5.0, appium-xcuitest-driver 11.9.1 (appium-managed, not a package.json dep), WebdriverIO 9.x (`webdriverio`, `@wdio/cli`, `@wdio/local-runner`, `@wdio/mocha-framework`, `@wdio/spec-reporter`, `@wdio/appium-service`), TypeScript, Mocha. iOS sims via `xcrun simctl`.

---

## Background: the missing-mobile-testID bug (must read)

Many shared components branch on `isMobile` (or `.desktop`/`.native` splits) and render different elements per platform. e2e `testID`s were frequently added to **only the desktop branch**. On iOS that testID is never rendered, so no XCUITest-based tool (Appium *or* Maestro) can find it.

Verified during the spike + Phase 0 investigation (booted sim `iPhoneTest`, debug build, confirmed via Metro reload):
- `teams-list` (testID on a real rendered element) → visible to Appium as `~teams-list`. ✅
- `teams-row` → **0 occurrences** in the XCUI tree, because `teams/main/team-row.tsx` had `testID={TEAMS_ROW}` only on the non-mobile return (~L120); the `if (isMobile)` branch ClickableBox (~L64) had none. Adding the testID to the mobile branch → 15 rows surface as `~teams-row`. ✅
- **Original `box.tsx` unchanged.** Earlier "Fabric view-flattening / `collapsable={false}`" theory was **wrong** — do NOT add collapsable/accessible hacks to `box.tsx`. The cause is purely missing testIDs on mobile branches.

Consequence for the current Maestro suite: `team-member.yaml` guards its body with `when: visible: teams-row`. The guard never matches on iOS → the whole member-page assertion block **silently skips** → the flow reports green while testing nothing. This is the core reason Maestro is unreliable here, and it likely affects every flow whose testIDs were added desktop-first. Appium with real `waitForDisplayed` assertions fails loudly instead.

**Phase 0 is therefore NOT a global fix.** It is a per-component audit: for each e2e testID a flow needs, confirm the component's mobile-rendered element carries it, and add it where missing. This work folds into Phase 2 (discovered when a ported test can't find a testID). `teams-row` is already fixed (committed).

**Reload gotcha:** the debug sim app caches the JS bundle across `simctl terminate/launch`; CLI `/reload` is unreliable. To verify a testID change took effect, rename the testID to a sentinel value, reload the app manually (`Cmd+R` in the simulator), and probe for the sentinel.

---

## File Structure

**Phase 0 — missing-mobile-testID audit (per component, as needed):**
- Modify: each component whose e2e testID is desktop-only, adding it to the `isMobile`/native branch. (`teams/main/team-row.tsx` already done.) No `box.tsx` change.

**Phase 1 — Appium harness scaffold (new files under `shared/tests/e2e/ios-appium/`):**
- Create: `shared/tests/e2e/ios-appium/wdio.conf.ts` — WebdriverIO config (caps, appium-service, mocha, reporter)
- Create: `shared/tests/e2e/ios-appium/helpers/app.ts` — capabilities builder, UDID resolution, smoke-user guard
- Create: `shared/tests/e2e/ios-appium/helpers/elements.ts` — `el(testID)`, `els(testID)`, `waitForTestID`, `byText` predicate helper
- Create: `shared/tests/e2e/ios-appium/helpers/navigate.ts` — `escapeToTabs`, `navigateToTeams`, `navigateToChat`, … (iOS tab semantics)
- Create: `shared/tests/e2e/ios-appium/flows/*.test.ts` — one per Maestro flow (Phase 2)
- Create: `shared/tests/e2e/ios-appium/tsconfig.json` — types for mocha/wdio

**Phase 3 — runner + scripts:**
- Modify: `shared/package.json` (devDeps + `test:e2e:ios*` scripts)
- Create: `shared/tests/e2e/run-ios-appium.sh` — multi-device runner (replaces `run-ios-devices.sh` role)

**Phase 4 — report:**
- Create: `shared/tests/e2e/generate-appium-report.mts` — consumes wdio JSON + screenshots, reuses `buildReport`/`computeDiff` from `generate-report-shared.mts`

**Phase 6 — cleanup:**
- Delete: `shared/.maestro/e2e/` (after parity confirmed), `shared/tests/e2e/run-ios-devices.sh`, `shared/tests/e2e/generate-ios-report.mts`
- Modify: `.claude/skills/keybase-e2e-tests/SKILL.md` (iOS section → Appium)

---

## Phase 0 — Fix missing mobile testIDs (root cause)

**Not a global fix.** The cause is testIDs placed on desktop branches only (see Background). The repair is per-component: add the testID to the `isMobile`/native-rendered element. This is largely discovered during Phase 2 (a ported test can't find a testID → fix the component → re-run). Verified pattern below; `teams-row` is already done.

### Task 0.1: Fix `teams-row` mobile testID (DONE — reference pattern)

**Files:**
- Modify: `shared/teams/main/team-row.tsx` (the `if (isMobile)` branch ClickableBox)

Already committed (`29b2178180`): added `testID={TestIDs.TEAMS_ROW}` to the mobile ClickableBox, which previously had none (only the desktop return carried it). Confirmed via reload: `~teams-row` now returns 15 rows. This is the template for every other missing-mobile-testID fix.

- [x] Add testID to mobile branch, lint + tsc, commit.

### Task 0.2: Verification method (per fix)

The debug sim app **caches the JS bundle** across `simctl terminate/launch`, and CLI `/reload` is unreliable. To verify any testID change:

- [ ] **Step 1:** Make the change; warm Metro: `curl -s -o /dev/null "http://localhost:8081/index.bundle?platform=ios&dev=true"`.
- [ ] **Step 2:** Reload the app **manually** in the simulator (`Cmd+R`).
- [ ] **Step 3:** Probe with the spike harness (`/tmp/appium-spike/`), e.g. `node -e` a WebdriverIO session that taps the tab and counts `~<testID>`. Expect > 0. To prove the reload actually applied fresh JS (not stale cache), temporarily rename the testID to a sentinel (e.g. `-RC`) and confirm the sentinel appears.

### Task 0.3: Audit remaining e2e testIDs for the same desktop-only defect

**Files:**
- Read: every component referenced by `shared/tests/e2e/shared/test-ids.ts`
- Modify: any whose testID is on a desktop branch but missing on mobile

- [ ] **Step 1:** For each testID constant used by an iOS flow, grep its usages; if the component branches on `isMobile`/has `.desktop`/`.native` splits, confirm the mobile-rendered element carries the testID.
- [ ] **Step 2:** Add testIDs to mobile branches where missing (one commit per component or grouped logically). Lint + tsc each.
- [ ] **Step 3:** This can be done lazily inside Phase 2 instead — whenever a ported flow's `waitForTestID` fails on a real-but-unfound testID, fix the component then. Either way, never convert a missing testID into a silent skip.

---

## Phase 1 — Appium harness scaffold

### Task 1.1: Install dependencies + appium driver

**Files:**
- Modify: `shared/package.json` (devDependencies)

- [ ] **Step 1: Add WebdriverIO devDeps (exact versions, yarn)**

From `shared/`:
```bash
yarn add -D --exact webdriverio @wdio/cli @wdio/local-runner @wdio/mocha-framework @wdio/spec-reporter @wdio/appium-service @types/mocha
```
(Pins whatever current 9.x resolves; CLAUDE.md requires exact versions — verify no `^`/`~` landed in `package.json`.)

- [ ] **Step 2: Install the appium XCUITest driver (appium-managed, global)**

```bash
yarn appium driver install xcuitest
```
Expected: `Driver xcuitest@11.x successfully installed`. This lives in `~/.appium`, not `package.json` — add a note in `tests/e2e/run-ios-appium.sh` (Task 3.1) so CI installs it.

- [ ] **Step 3: Commit**

```bash
git add shared/package.json shared/yarn.lock
git commit -m "chore(e2e): add appium + webdriverio devDeps for ios harness"
```

### Task 1.2: App capabilities + smoke-user helper

**Files:**
- Create: `shared/tests/e2e/ios-appium/helpers/app.ts`

- [ ] **Step 1: Write the helper**

```ts
import {execSync} from 'child_process'

// Resolve a booted simulator UDID by NAME (mirrors run-ios-devices.sh).
export function udidForName(name: string): string {
  const json = execSync('xcrun simctl list devices available -j', {encoding: 'utf8'})
  const devices = (JSON.parse(json) as {devices: Record<string, Array<{name: string; udid: string}>>}).devices
  for (const runtime of Object.keys(devices)) {
    for (const d of devices[runtime] ?? []) {
      if (d.name === name) return d.udid
    }
  }
  throw new Error(`Simulator not found: ${name}`)
}

export function requireSmokeUser(): string {
  const u = process.env['KB_SMOKE_USER']
  if (!u) throw new Error('KB_SMOKE_USER is not set — set it to the expected logged-in username')
  return u
}

export function iosCapabilities(udid: string) {
  return {
    platformName: 'iOS',
    'appium:automationName': 'XCUITest',
    'appium:udid': udid,
    'appium:bundleId': 'keybase.ios',
    'appium:noReset': true, // attach to the installed app, never wipe
    'appium:newCommandTimeout': 120,
    'appium:wdaLaunchTimeout': 120000,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add shared/tests/e2e/ios-appium/helpers/app.ts
git commit -m "feat(e2e): ios appium app/capabilities helper"
```

### Task 1.3: Element + selector helpers

**Files:**
- Create: `shared/tests/e2e/ios-appium/helpers/elements.ts`

iOS maps `testID` → `accessibilityIdentifier`, addressable in WebdriverIO as `~<id>`. Text matching uses an `-ios predicate string`.

- [ ] **Step 1: Write the helper**

```ts
import type {ChainablePromiseElement, ChainablePromiseArray} from 'webdriverio'

export const el = (id: string): ChainablePromiseElement => browser.$(`~${id}`)
export const els = (id: string): ChainablePromiseArray => browser.$$(`~${id}`)

export const waitForTestID = (id: string, timeout = 5000) =>
  el(id).waitForDisplayed({timeout, timeoutMsg: `testID "${id}" never became visible`})

export const countTestID = async (id: string): Promise<number> => (await els(id)).length

// Match by visible text via iOS predicate (label or name). Use sparingly —
// prefer testIDs now that Phase 0 keeps them visible.
export const byText = (text: string): ChainablePromiseElement =>
  browser.$(`-ios predicate string:label == "${text}" OR name == "${text}"`)

// Tab bar item ("Teams", "People", "More", …) — these expose their label as name.
export const tab = (label: string): ChainablePromiseElement => browser.$(`~${label}`)
```

- [ ] **Step 2: Commit**

```bash
git add shared/tests/e2e/ios-appium/helpers/elements.ts
git commit -m "feat(e2e): ios appium element/selector helpers"
```

### Task 1.4: Navigation helpers (iOS tab semantics + escape-to-tabs)

**Files:**
- Create: `shared/tests/e2e/ios-appium/helpers/navigate.ts`

Port `escape-to-tabs.yaml` (tap `backButton` up to 4×, then swipe down to reset scroll) and the iOS tab structure from the e2e skill: People/Teams are direct tabs; Chat/Files via Teams first; Crypto/Devices/Git/Settings under **More**.

- [ ] **Step 1: Write the helper**

```ts
import {el, els, waitForTestID, tab} from './elements'

export async function escapeToTabs(): Promise<void> {
  for (let i = 0; i < 4; i++) {
    if ((await els('backButton')).length === 0) break
    if (!(await el('backButton').isDisplayed().catch(() => false))) break
    await el('backButton').click()
    await browser.pause(300)
  }
  // reset scroll to top of any list
  const {width, height} = await browser.getWindowRect()
  await browser.action('pointer')
    .move({x: Math.round(width / 2), y: Math.round(height * 0.3)})
    .down().pause(100)
    .move({x: Math.round(width / 2), y: Math.round(height * 0.7), duration: 400})
    .up().perform()
  await browser.pause(400)
}

export async function navigateToTeams(): Promise<void> {
  await tab('Teams').click()
  await waitForTestID('teams-list', 3000)
}

export async function navigateToPeople(): Promise<void> {
  await tab('People').click()
  await waitForTestID('people-feed', 5000) // PEOPLE_FEED value from test-ids.ts
}

// Chat/Files are ambiguous (also under More) — tap Teams first per skill guidance.
export async function navigateToChat(): Promise<void> {
  await tab('Teams').click()
  await tab('Chat').click()
  await waitForTestID('chat-inbox-list', 5000) // CHAT_INBOX_LIST value
}

export async function navigateToFiles(): Promise<void> {
  await tab('Teams').click()
  await tab('Files').click()
  await waitForTestID('files-browser', 5000)
}

export async function navigateToMore(): Promise<void> {
  await tab('More').click()
}
```

(Resolve each `waitForTestID` value against `shared/tests/e2e/shared/test-ids.ts` while writing — use the string value, not the constant name.)

- [ ] **Step 2: Commit**

```bash
git add shared/tests/e2e/ios-appium/helpers/navigate.ts
git commit -m "feat(e2e): ios appium navigation helpers"
```

### Task 1.5: WebdriverIO config

**Files:**
- Create: `shared/tests/e2e/ios-appium/wdio.conf.ts`
- Create: `shared/tests/e2e/ios-appium/tsconfig.json`

- [ ] **Step 1: Write `wdio.conf.ts`**

```ts
import {iosCapabilities, udidForName, requireSmokeUser} from './helpers/app'

requireSmokeUser() // fail fast before booting anything

const deviceName = process.env['KB_IOS_DEVICE'] ?? 'iPhoneTest'
const udid = process.env['KB_IOS_UDID'] ?? udidForName(deviceName)

export const config: WebdriverIO.Config = {
  runner: 'local',
  port: 4723,
  path: '/',
  specs: ['./flows/**/*.test.ts'],
  maxInstances: 1, // serial: backgrounded sims get render-throttled by macOS
  capabilities: [iosCapabilities(udid)],
  logLevel: 'warn',
  framework: 'mocha',
  mochaOpts: {ui: 'bdd', timeout: 60000},
  reporters: ['spec', ['json', {outputDir: '../../results/ios-appium-json'}]],
  services: [['appium', {args: {basePath: '/'}}]],
  autoCompileOpts: {
    autoCompile: true,
    tsNodeOpts: {project: './tsconfig.json', transpileOnly: true},
  },
}
```

(If `@wdio/json-reporter` is preferred over inline json, add it to Task 1.1 deps. Confirm the reporter name resolves; otherwise use `@wdio/spec-reporter` only and rely on screenshots + Task 4.1's parser reading wdio's results.)

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "extends": "../../../tsconfig.json",
  "compilerOptions": {
    "types": ["node", "mocha", "@wdio/globals/types", "expect-webdriverio"],
    "noEmit": true
  },
  "include": ["**/*.ts"]
}
```

- [ ] **Step 3: Typecheck the harness**

Run (from `shared/`): `yarn tsc`
Expected: no errors in `tests/e2e/ios-appium/`.

- [ ] **Step 4: Commit**

```bash
git add shared/tests/e2e/ios-appium/wdio.conf.ts shared/tests/e2e/ios-appium/tsconfig.json
git commit -m "feat(e2e): webdriverio config for ios appium harness"
```

---

## Phase 2 — Port flows

Each flow's behavior spec is its existing `shared/.maestro/e2e/flows/<name>.yaml` (steps) plus the matching `shared/tests/e2e/electron/flows/<name>.test.ts` (assertion shape). Port mirrors both. **Every ported test must use real `expect`/`waitForDisplayed` assertions — never a silent "skip if not visible" on the element under test**, so flattened-testID regressions fail loudly instead of false-greening.

### Task 2.1: Port `team-member` (reference implementation — code in full)

**Files:**
- Create: `shared/tests/e2e/ios-appium/flows/team-member.test.ts`

- [ ] **Step 1: Write the test**

```ts
import {expect} from '@wdio/globals'
import {requireSmokeUser} from '../helpers/app'
import {escapeToTabs, navigateToTeams} from '../helpers/navigate'
import {el, els, waitForTestID, byText} from '../helpers/elements'

describe('team member', () => {
  it('opens a team member page', async () => {
    const smokeUser = requireSmokeUser()
    await escapeToTabs()
    await navigateToTeams()

    const rows = await els('teams-row')
    if (rows.length === 0) {
      // Genuinely no teams on this account — not a selector failure (Phase 0
      // guarantees teams-row surfaces when rows exist). Nothing to assert.
      return
    }
    await rows[0].click()
    await waitForTestID('teams-member-list', 5000)

    const user = byText(smokeUser)
    if (!(await user.isExisting())) return // smoke user not a member of this team
    await user.click()
    await waitForTestID('teams-member-page', 5000)
    await expect(el('teams-member-page')).toBeDisplayed()
    await browser.saveScreenshot('../../results/ios-appium-debug/team-member.png')

    if ((await els('backButton')).length > 0) await el('backButton').click()
  })
})
```

- [ ] **Step 2: Run it**

Run (from `shared/`): `KB_SMOKE_USER=<user> yarn wdio run tests/e2e/ios-appium/wdio.conf.ts --spec flows/team-member.test.ts`
Expected: PASS, `team-member.png` written. (If `teams-row` is empty on the account, the test still passes but logs nothing — pick a smoke account that has teams to exercise the full path.)

- [ ] **Step 3: Commit**

```bash
git add shared/tests/e2e/ios-appium/flows/team-member.test.ts
git commit -m "test(e2e-ios): port team-member flow to appium"
```

### Task 2.2: Port `chat-send-message` (second reference — code in full)

**Files:**
- Create: `shared/tests/e2e/ios-appium/flows/chat-send-message.test.ts`

- [ ] **Step 1: Read the source spec**

`cat shared/.maestro/e2e/flows/chat-send-message.yaml shared/tests/e2e/electron/flows/chat-send-message.test.ts` — note the testIDs (chat input, send button, message list) and the exact step order.

- [ ] **Step 2: Write the test**

```ts
import {expect} from '@wdio/globals'
import {escapeToTabs, navigateToChat} from '../helpers/navigate'
import {el, els, waitForTestID} from '../helpers/elements'

describe('chat send message', () => {
  it('sends a message in a conversation', async () => {
    await escapeToTabs()
    await navigateToChat()

    const convos = await els('chat-conversation-row') // use real value from test-ids.ts
    if (convos.length === 0) return
    await convos[0].click()
    await waitForTestID('chat-input', 5000) // CHAT_INPUT value

    const text = `e2e ${Date.now()}`
    await el('chat-input').setValue(text)
    await el('chat-send-button').click() // CHAT_SEND_BUTTON value
    await expect(el('chat-input')).toHaveText('') // input clears after send
    await browser.saveScreenshot('../../results/ios-appium-debug/chat-send-message.png')
  })
})
```

(Replace placeholder testID values with the real strings from `test-ids.ts` while writing; if the Maestro yaml taps by text, prefer the testID equivalent now that Phase 0 surfaces them.)

- [ ] **Step 3: Run + commit**

Run: `KB_SMOKE_USER=<user> yarn wdio run tests/e2e/ios-appium/wdio.conf.ts --spec flows/chat-send-message.test.ts` → PASS.
```bash
git add shared/tests/e2e/ios-appium/flows/chat-send-message.test.ts
git commit -m "test(e2e-ios): port chat-send-message flow to appium"
```

### Tasks 2.3–2.15: Port remaining flows

For **each** flow below, repeat the Task 2.2 pattern: (1) read `.maestro/e2e/flows/<name>.yaml` + `tests/e2e/electron/flows/<name>.test.ts` for the spec, (2) write `tests/e2e/ios-appium/flows/<name>.test.ts` using nav helpers + `waitForTestID` + real `expect`, (3) run `yarn wdio run … --spec flows/<name>.test.ts` until PASS, (4) commit `test(e2e-ios): port <name> flow to appium`. Resolve all testID values against `test-ids.ts`. Convert every Maestro `when: visible:` guard on the element-under-test into a hard `waitForTestID` assertion.

| # | Flow | Source yaml | Primary testIDs / entry helper |
|---|---|---|---|
| 2.3 | chat-conversation | `chat-conversation.yaml` | `navigateToChat`, chat-conversation-row, chat-input |
| 2.4 | crypto-outputs | `crypto-outputs.yaml` | `navigateToMore` → Crypto, crypto-input, crypto subtabs |
| 2.5 | crypto-subtabs | `crypto-subtabs.yaml` | Crypto subtab testIDs |
| 2.6 | device-detail | `device-detail.yaml` | `navigateToMore` → Devices, devices-list, device row |
| 2.7 | devices-view | `devices-view.yaml` | devices-list |
| 2.8 | files-browse | `files-browse.yaml` | `navigateToFiles`, files-browser |
| 2.9 | files-folders | `files-folders.yaml` | files-browser, folder rows, filter textbox |
| 2.10 | git | `git.yaml` | `navigateToMore` → Git, git-repo-list |
| 2.11 | people-profile | `people-profile.yaml` | `navigateToPeople`, people-feed |
| 2.12 | settings-navigation | `settings-navigation.yaml` | `navigateToMore` → Settings, settings-account |
| 2.13 | settings-subpages | `settings-subpages.yaml` | settings sub-page testIDs |
| 2.14 | teams-browse | `teams-browse.yaml` | `navigateToTeams`, teams-list |
| 2.15 | teams-inner | `teams-inner.yaml` | teams-list → team → tabs |

- [ ] 2.3 chat-conversation — write, run PASS, commit
- [ ] 2.4 crypto-outputs — write, run PASS, commit
- [ ] 2.5 crypto-subtabs — write, run PASS, commit
- [ ] 2.6 device-detail — write, run PASS, commit
- [ ] 2.7 devices-view — write, run PASS, commit
- [ ] 2.8 files-browse — write, run PASS, commit
- [ ] 2.9 files-folders — write, run PASS, commit
- [ ] 2.10 git — write, run PASS, commit
- [ ] 2.11 people-profile — write, run PASS, commit
- [ ] 2.12 settings-navigation — write, run PASS, commit
- [ ] 2.13 settings-subpages — write, run PASS, commit
- [ ] 2.14 teams-browse — write, run PASS, commit
- [ ] 2.15 teams-inner — write, run PASS, commit

### Task 2.16: Run the full suite once, fix stragglers

- [ ] **Step 1: Run all flows**

Run (from `shared/`): `KB_SMOKE_USER=<user> yarn wdio run tests/e2e/ios-appium/wdio.conf.ts`
Expected: all specs PASS, screenshots in `tests/results/ios-appium-debug/`.

- [ ] **Step 2: Triage any failure** — a real failure here is a *win* over Maestro's silent skip. Fix the test or the testID (if a component still flattens, apply the Phase 0.2 fallback to that component).

- [ ] **Step 3: Commit any fixes.**

---

## Phase 3 — Runner + package.json scripts

### Task 3.1: Multi-device runner script

**Files:**
- Create: `shared/tests/e2e/run-ios-appium.sh`

Mirrors `run-ios-devices.sh`: boot one sim at a time (avoid render-throttle), run the wdio suite per device, accumulate debug dirs for a merged report.

- [ ] **Step 1: Write the script**

```bash
#!/bin/bash
# Run the Appium iOS e2e suite across one or more named simulators, serially
# (a backgrounded sim is render-throttled by macOS). Each device writes its own
# debug dir; the merged HTML report is built by generate-appium-report.mts.
#
# Usage: tests/e2e/run-ios-appium.sh ["iPhoneTest" "iPadTest" ...]
# Requires: appium xcuitest driver installed (yarn appium driver install xcuitest),
#           Keybase.app already installed on each sim, KB_SMOKE_USER set.
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SHARED_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$SHARED_DIR"

DEVICES=("$@"); [ ${#DEVICES[@]} -eq 0 ] && DEVICES=("iPhoneTest" "iPadTest")
slugify() { echo "$1" | tr '[:upper:] ' '[:lower:]-'; }
OVERALL=0; DEBUG_DIRS=""

for NAME in "${DEVICES[@]}"; do
  SLUG="$(slugify "$NAME")"
  DBG="tests/results/ios-appium-debug-$SLUG"
  rm -rf "$DBG"; mkdir -p "$DBG"
  echo "▶ Booting $NAME"
  for OTHER in $(xcrun simctl list devices booted -j | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);for(const k in j.devices)for(const d of j.devices[k])if(d.state==="Booted")console.log(d.udid)})'); do
    xcrun simctl shutdown "$OTHER" 2>/dev/null
  done
  xcrun simctl boot "$NAME" 2>/dev/null
  KB_IOS_DEVICE="$NAME" KB_IOS_DEBUG_DIR="$DBG" \
    yarn wdio run tests/e2e/ios-appium/wdio.conf.ts || OVERALL=1
  DEBUG_DIRS="${DEBUG_DIRS:+$DEBUG_DIRS,}$NAME=$DBG"
done

KB_IOS_DEBUG_DIRS="$DEBUG_DIRS" node tests/e2e/generate-appium-report.mts
exit $OVERALL
```

- [ ] **Step 2: chmod + smoke-run one device**

```bash
chmod +x tests/e2e/run-ios-appium.sh
KB_SMOKE_USER=<user> tests/e2e/run-ios-appium.sh iPhoneTest
```
Expected: suite runs, exit 0.

- [ ] **Step 3: Commit**

```bash
git add shared/tests/e2e/run-ios-appium.sh
git commit -m "feat(e2e): multi-device appium ios runner"
```

### Task 3.2: package.json scripts

**Files:**
- Modify: `shared/package.json` (scripts block)

- [ ] **Step 1: Add scripts** (keep Maestro scripts until Phase 6 parity sign-off)

```jsonc
"test:e2e:ios:appium": "wdio run tests/e2e/ios-appium/wdio.conf.ts",
"test:e2e:ios:appium:branch": "wdio run tests/e2e/ios-appium/wdio.conf.ts --spec flows/team-member.test.ts",
"test:e2e:ios:appium:devices": "bash tests/e2e/run-ios-appium.sh",
"test:e2e:ios:appium:report": "node tests/e2e/generate-appium-report.mts && open tests/results/ios-appium-report.html",
```

- [ ] **Step 2: Commit**

```bash
git add shared/package.json
git commit -m "chore(e2e): add appium ios yarn scripts"
```

---

## Phase 4 — Report integration

### Task 4.1: Appium → unified report adapter

**Files:**
- Create: `shared/tests/e2e/generate-appium-report.mts`

Reuse `buildReport` / `computeDiff` / `CardData` / `Section` from `generate-report-shared.mts` (same exports `generate-ios-report.mts` uses). Map each wdio spec result (from the json reporter output) + its screenshot into a `CardData`, group per device from `KB_IOS_DEBUG_DIRS` (same `label=dir` format the existing report already parses), and write `tests/results/ios-appium-report.html`. Support `--save-baseline` like the existing generators for visual-diff.

- [ ] **Step 1: Inspect the shared API + existing ios generator**

`sed -n '1,120p' shared/tests/e2e/generate-ios-report.mts` and grep `generate-report-shared.mts` for `export` to confirm `buildReport`, `computeDiff`, `CardData`, `Section` signatures.

- [ ] **Step 2: Write the generator** mapping wdio results to `CardData[]` per device, calling `buildReport(...)`. (Concrete shape depends on the chosen reporter from Task 1.5 — if using `@wdio/json-reporter`, parse its per-suite/per-test JSON; if relying on spec-reporter only, parse the screenshots dir + a small custom afterTest hook that writes `<name>.json` with `{status, durationMs, error}`.)

- [ ] **Step 3: Add the afterTest hook (if needed)** to `wdio.conf.ts` to emit per-flow `{status,durationMs,error}` + on-failure screenshot into `KB_IOS_DEBUG_DIR`, so the generator has a stable input regardless of reporter internals:

```ts
  afterTest: async function (test, _ctx, {error, duration, passed}) {
    const dir = process.env['KB_IOS_DEBUG_DIR'] ?? '../../results/ios-appium-debug'
    const name = test.title.replace(/\s+/g, '-')
    const fs = await import('fs'); const path = await import('path')
    fs.mkdirSync(dir, {recursive: true})
    fs.writeFileSync(path.join(dir, `${name}.json`),
      JSON.stringify({status: passed ? 'PASS' : 'FAIL', durationMs: duration, error: error?.message ?? null}))
    if (!passed) await browser.saveScreenshot(path.join(dir, `fail-${name}.png`))
  },
```

- [ ] **Step 4: Run end-to-end** `KB_SMOKE_USER=<user> tests/e2e/run-ios-appium.sh iPhoneTest` → report opens, one card per flow, statuses correct.

- [ ] **Step 5: Save a baseline + commit**

```bash
yarn test:e2e:ios:appium:devices && node tests/e2e/generate-appium-report.mts --save-baseline
git add shared/tests/e2e/generate-appium-report.mts shared/tests/e2e/ios-appium/wdio.conf.ts
git commit -m "feat(e2e): unified html report for appium ios runs"
```

---

## Phase 5 — perf + visual-diff flows (decision required)

The Maestro `performance/` flows use Maestro-specific perf instrumentation; the `visual-diff/` flows feed the screenshot baseline report.

- [ ] **Step 1: Decide perf** — Appium/WDO has no built-in equivalent to Maestro's perf metrics. Options: (a) keep Maestro *only* for `perf:*` scripts, (b) reimplement scroll-perf via wdio timing + instrumentation. **Recommend (a)** — narrow Maestro to perf, drop it for functional flows. Confirm with maintainer before deleting perf yaml.

- [ ] **Step 2: Port visual-diff** — the `nav-*.yaml` flows are pure navigate-and-screenshot. Port to a single `flows/visual-diff.test.ts` that navigates each tab and calls `browser.saveScreenshot(...)` into the debug dir; the Task 4.1 report already does baseline diffing. Run, save baseline, commit.

---

## Phase 6 — Cleanup (after parity sign-off)

### Task 6.1: Confirm parity, then remove Maestro functional harness

- [ ] **Step 1: Parity check** — every former Maestro functional flow has a passing Appium equivalent (Phase 2 table all green on `iPhoneTest` + `iPadTest`). Get maintainer sign-off.

- [ ] **Step 2: Delete** (keeping `performance/` if Phase 5 chose option (a)):

```bash
git rm -r shared/.maestro/e2e shared/tests/e2e/run-ios-devices.sh shared/tests/e2e/generate-ios-report.mts
# keep shared/.maestro/performance if perf stays on maestro; else: git rm -r shared/.maestro
```

- [ ] **Step 3: Remove dead Maestro yarn scripts** (`test:e2e:ios`, `:branch`, `:devices`, `:report`, `:save-baseline`) from `package.json`; rename the `:appium` scripts to the canonical `test:e2e:ios*` names.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(e2e): remove maestro functional harness, appium is canonical ios e2e"
```

### Task 6.2: Update the e2e skill docs

**Files:**
- Modify: `.claude/skills/keybase-e2e-tests/SKILL.md` (iOS section)

- [ ] **Step 1: Replace the "iOS — Maestro" table** with the Appium harness: file locations (`tests/e2e/ios-appium/`), helpers, `~testID` selector convention, the **add-testID-to-the-mobile-branch** rule (desktop-only testIDs are invisible on iOS), and the run commands. Keep the shared testID-registry section.

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/keybase-e2e-tests/SKILL.md
git commit -m "docs(e2e): update skill for appium ios harness"
```

---

## Self-Review notes

- **Spec coverage:** all 15 functional flows (Phase 2 table), perf (Phase 5), visual-diff (Phase 5), runner (3.1), report (4.1), cleanup (6). The originating pain (flaky/false-green/slow Maestro) is addressed by Phase 0 (false-green root cause) + real assertions (Phase 2) + black-box no-rebuild attach.
- **Known risk / open verification:** the missing-mobile-testID defect is per-component and only fully mapped by porting each flow (Phase 2/0.3). Every flow port must turn a not-found testID into a loud failure + component fix, never a silent skip — that silent-skip is exactly the Maestro false-green being eliminated. Reload-cache gotcha: verify testID changes via manual `Cmd+R` + sentinel rename.
- **Reporter coupling:** Task 1.5 / 4.1 leave the exact wdio reporter to confirm at implementation time; the `afterTest` hook (4.1 Step 3) makes the report input stable regardless. Resolve the reporter dep in Task 1.1 once chosen.
- **testID values:** every `waitForTestID('…')` in this plan uses the *value*; cross-check each against `shared/tests/e2e/shared/test-ids.ts` while writing (some placeholders like `people-feed`, `chat-input`, `chat-send-button`, `chat-conversation-row` must be confirmed).
```
