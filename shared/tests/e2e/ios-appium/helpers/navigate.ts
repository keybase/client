import type {ChainablePromiseElement} from 'webdriverio'
import * as T from '../../shared/test-ids'
import {byText, el, els, waitForTestID, tab} from './elements'
import {fiberPrelude} from './fiber-prelude'
import {jsEval, waitFor} from './lifecycle'
import {underDeadline} from '../../shared/deadline.ts'
import {isAttemptOver} from '../gate/attempt-binding-lib'
import {dragToClear} from '../gate/clear-row-lib'
import {expectScreen, visibleScreen} from '../gate/screens.ts'
import {retriedNavigation} from '../gate/step.ts'
import {HEADER_BAND, measuredButtonAmong, onScreen, type Rect} from '../gate/header-button-lib'

// Swipe up in the LEFT pane until the element is on-screen (DISPLAYED, not just
// present — a settings row below the fold still "exists" in the tree). Swiping
// the left ~15% scrolls the tablet settings LeftNav (and is within the list on
// phone too). Generic over a target check so it works for testIDs and text.
async function scrollUpUntil(visible: () => Promise<boolean>, maxSwipes: number): Promise<void> {
  for (let i = 0; i < maxSwipes; i++) {
    if (await visible()) return
    const {width, height} = await browser.getWindowRect()
    const x = Math.round(width * 0.15)
    await browser
      .action('pointer')
      .move({x, y: Math.round(height * 0.7)})
      .down()
      .move({x, y: Math.round(height * 0.3), duration: 300})
      .up()
      .perform()
    await browser.waitUntil(visible, {timeout: 800, interval: 100}).catch(() => {})
  }
}

// Android: uiautomator's tree only contains ON-SCREEN views (unlike XCUITest,
// which exposes below-the-fold rows), so a byText tap on an off-screen settings
// row simply never finds it. UiScrollable.scrollIntoView scrolls the first
// scrollable on screen in BOTH directions until the target is visible — also
// covering the case where a prior test left the list scrolled down.
async function androidScrollIntoView(uiSelector: string): Promise<void> {
  await browser
    .$(`android=new UiScrollable(new UiSelector().scrollable(true)).scrollIntoView(${uiSelector})`)
    .waitForExist({timeout: 10000})
    .catch(() => {})
}

export async function scrollToTestID(id: string, maxSwipes = 8): Promise<void> {
  if (browser.isAndroid) {
    await androidScrollIntoView(`new UiSelector().resourceId("${id}")`)
    return
  }
  await scrollUpUntil(async () => el(id).isDisplayed().catch(() => false), maxSwipes)
}

export async function scrollDownToText(text: string, maxSwipes = 8): Promise<void> {
  if (browser.isAndroid) {
    await androidScrollIntoView(`new UiSelector().textContains("${text}")`)
    return
  }
  await scrollUpUntil(async () => byText(text).isDisplayed().catch(() => false), maxSwipes)
}

// Tap a settings-root row by its label, scrolling it into view first: Android's
// uiautomator tree omits off-screen rows (and a prior test may have left the
// list scrolled), while on iOS the scroll no-ops when the row is already
// visible. Use this for every row tap that follows navigateToMore. Bound (s): the scroll 25 and the
// tap 1, plus clearOfTabBar 29 on iOS = 55.
export async function tapSettingsRow(text: string): Promise<void> {
  await scrollDownToText(text)
  if (!browser.isAndroid) await clearOfTabBar(() => byText(text), `the "${text}" row`)
  await byText(text).click()
}

const PAN_OVERSHOOT = 60

const isStale = (e: unknown) => e instanceof Error && /stale element/i.test(`${e.name} ${e.message}`)

// The frame of the row `find` finds, and the band between the nav bar's bottom and the tab bar's top,
// read afresh; undefined when the row is not in the tree within a second, or an element went stale
// between its find and its read (the list drew it again, as it does after a drag). Bound: the row's
// wait 1 and its read 1, the bars read 2 and their frames 2 = 6.
const rowAndBand = async (find: () => ChainablePromiseElement, height: number) => {
  try {
    const found = find()
    if (!(await found.waitForExist({interval: 100, timeout: 1_000}).then(() => true, () => false))) return undefined
    const row = await browser.getElementRect((await found.getElement()).elementId)
    const bars = await browser
      .$$('-ios predicate string:type == "XCUIElementTypeTabBar" OR type == "XCUIElementTypeNavigationBar"')
      .getElements()
    let top = 0
    let bottom = height
    for (const b of bars) {
      const r = await browser.getElementRect(b.elementId)
      // a bar in the lower half is the tab bar; one in the upper half is the nav bar
      if (r.y > height / 2) bottom = Math.min(bottom, r.y)
      else top = Math.max(top, r.y + r.height)
    }
    return {bottom, row, top}
  } catch (e) {
    if (isStale(e)) return undefined
    throw e
  }
}

// scrollUpUntil stops once a row reads displayed, which a row under the floating tab bar does, and a
// tap there lands on the tab bar (live: the Files tab opened). Drags the list until the row's middle,
// where the caller's click taps it, lies well inside the nav bar and the tab bar (dragToClear);
// throws rather than let the caller tap a row whose middle is under a bar. Each check finds the row again (`find`), and one that found no row or read a stale
// element counts as a check with no drag. Worst case (s): the window read 2, then four checks of 6
// (rowAndBand) and three drags of 1 = 29.
export async function clearOfTabBar(find: () => ChainablePromiseElement, what: string): Promise<void> {
  const {height, width} = await browser.getWindowRect()
  let stale = false
  for (let i = 0; i <= 3; i++) {
    const read = await rowAndBand(find, height)
    stale = !read
    if (!read) continue
    const dy = dragToClear(read.row, read.top, read.bottom)
    if (dy === 0) return
    if (dy === undefined || i === 3) break
    // A move this short reads as a tap on the row under the finger (live: it opened Advanced), so the
    // touch goes PAN_OVERSHOOT past the target first, and comes back to it before lifting: the list
    // pans, and comes to rest dy from where it was.
    const x = Math.round(width * 0.15)
    const from = Math.round(height / 2 - dy / 2)
    const past = from + dy + Math.sign(dy) * PAN_OVERSHOOT
    await browser
      .action('pointer', {parameters: {pointerType: 'touch'}})
      .move({x, y: from})
      .down()
      .move({duration: 300, x, y: past})
      .move({duration: 200, x, y: from + dy})
      .pause(200)
      .up()
      .perform()
  }
  throw new Error(`${what} could not be brought clear of the tab bar${stale ? ' (its last read found no row, or a stale one)' : ''}`)
}

// A modal's header Cancel (a native bar item), not a Cancel in the screen's body or footer.
export const HEADER_CANCEL = '-ios class chain:**/XCUIElementTypeNavigationBar/**/XCUIElementTypeButton[`label == "Cancel"`]'

// A visible modal header button. Exact labels on buttons only: a tab root shows none of these,
// while message snippets and feed text can contain the words.
// The app's custom back button and a native bar's back by their ids, too, in the same search.
const NOT_A_TAB_ROOT_PRED = `-ios predicate string:name IN {"${T.COMMON_BACK_BUTTON}", "BackButton"} OR (type == "XCUIElementTypeButton" AND label IN {"Cancel", "Done", "Close", "Back"} AND visible == 1)`

// True once we're at the root of a tab. The tab bar alone isn't proof: on iPad
// it stays visible inside pushed stack screens, so also require that no back
// button (app-custom or native) is present.
export async function atTabs(): Promise<boolean> {
  if (browser.isAndroid) {
    // tab() scopes to the native BottomNavigationView's label resource-ids with
    // EXACT text — a looser contains-match gets fooled by screen content (the
    // emoji picker's "Smileys & People" category once made atTabs report true
    // and stranded an entire run on the picker). Require two labels so a single
    // stray match can't fake a root.
    if (!(await tab('People').isExisting().catch(() => false))) return false
    if (!(await tab('More').isExisting().catch(() => false))) return false
    if ((await els(T.COMMON_BACK_BUTTON).length) > 0) return false
    return (await browser.$$('//*[@content-desc="Navigate up" or @content-desc="Back"]').length) === 0
  }
  // The router says whether a tab's root shows: signed in, nothing above the tabs (a phone pushes every
  // screen but a tab's root above them), no modal, and the tab's own stack at its root (a tablet pushes
  // into it, and keeps the tab bar visible over those screens). A runtime the inspector cannot reach
  // yet (just relaunched) is read off the tree instead.
  const root = await jsEval<boolean>(TAB_ROOT_BODY).catch((e: unknown) => {
    if (isAttemptOver(e)) throw e
    return undefined
  })
  if (root === false) return false
  // without the router's answer, the tab bar at least shows (the search below finds any back)
  if (root === undefined && (await els('People').length) === 0) return false
  // One search for what the router does not hold: a sheet or popup drawn outside navigation (the
  // tab bar stays in the tree under it) shows a header or back button, and a pushed screen still
  // sliding away keeps its back button for a moment.
  return (await browser.$$(NOT_A_TAB_ROOT_PRED).length) === 0
}

const TAB_ROOT_BODY = `const NT = kbModule('constants/nav-tree.tsx')
  const s = kbModule('constants/router.tsx').getRootState()
  return NT.isLoggedIn(s) && (s.index ?? 0) === 0 && NT.modalStack(s).length === 0 && (NT.activeStack(s)?.routes?.length ?? 0) === 1`

// Dismiss the keyboard ONLY when one is present — calling mobile: hideKeyboard
// with no keyboard up hangs until timeout. The keyboard (raised by chat/crypto/
// feedback inputs) can cover tappable UI on later screens.
export async function dismissKeyboard(): Promise<void> {
  // isKeyboardShown is a direct Appium endpoint (fast) — avoid an
  // //XCUIElementTypeKeyboard xpath, which is a slow full-tree search per call.
  if (await browser.isKeyboardShown().catch(() => false)) {
    if (browser.isAndroid) await browser.hideKeyboard().catch(() => {})
    else await browser.execute('mobile: hideKeyboard').catch(() => {})
  }
}

// Tap the leading (leftmost) button of a native NavigationBar — the back
// chevron — when present. Needed because the back button's accessibility name
// is NOT stable across iOS versions: on iOS 26 it surfaces as "BackButton",
// but on iOS 16.4 the same chevron comes through with the prior screen's
// label (e.g. "loggedIn"), so name-based lookups miss it. Position is reliable:
// the back control is always the leftmost button inside the nav bar. Returns
// true if it tapped one.
// requireLeftEdge: only tap when the leftmost nav button sits near the screen's
// left edge — i.e. a genuine back chevron. Use it for goBack (a single hop where
// a wrong tap has no recovery): on an iPad split view the conversation pane's
// leading button is mid-screen and is NOT a back control, so this skips it and
// lets the caller fall back to the edge-swipe. escapeToTabs omits the guard
// because its loop re-checks atTabs and self-corrects a mis-tap.
// `beforeTap` runs right before the tap (escapeToTabs' deadline check).
async function tapNavBack(requireLeftEdge = false, beforeTap?: () => void): Promise<boolean> {
  const btns = await browser.$$('//XCUIElementTypeNavigationBar//XCUIElementTypeButton').getElements()
  let leftmost: {el: (typeof btns)[number]; x: number} | undefined
  for (const b of btns) {
    if (!(await b.isDisplayed().catch(() => false))) continue
    const {x} = await b.getLocation().catch(() => ({x: Number.POSITIVE_INFINITY}))
    if (!leftmost || x < leftmost.x) leftmost = {el: b, x}
  }
  if (!leftmost) return false
  if (requireLeftEdge) {
    const {width} = await browser.getWindowRect()
    if (leftmost.x > width * 0.15) return false
  }
  beforeTap?.()
  await leftmost.el.click().catch(() => {})
  return true
}

// Climb out of any pushed screen / stack back to the root tab bar. The app
// restores its last screen on launch, and different screens expose different
// back affordances: app-custom headers use testID "backButton", native nav
// bars expose "BackButton", and some screens only pop via the iOS left-edge
// swipe. Try each, re-checking for the tab bar, until we're home.
// One predicate for any modal/sheet dismiss control (Done/Close/Cancel), any
// element type — cheaper than three separate searches.
// visible == 1: hidden nav-stack screens and keyboard toolbars can carry their
// own Done/Close/Cancel — clicking one is a silent no-op that loops forever.
const DISMISS_PRED =
  '-ios predicate string:(label CONTAINS "Done" OR name CONTAINS "Done" OR label CONTAINS "Close" OR name CONTAINS "Close" OR label CONTAINS "Cancel" OR name CONTAINS "Cancel") AND visible == 1'

// Wait for a tapped control to take effect — return as soon as the tab bar
// appears OR the control we clicked is gone (the screen transitioned). No fixed
// sleep: this detects the change and proceeds immediately.
async function settleAfter(ctrl: ChainablePromiseElement): Promise<void> {
  await browser
    .waitUntil(async () => (await atTabs()) || !(await ctrl.isExisting().catch(() => false)), {
      timeout: 3000,
      interval: 80,
    })
    .catch(() => {})
}

// A modal opened over another modal (the chat block modal over the info panel) has its header's
// Cancel/Close/Done reported visible="false" by XCUITest, though on screen: DISMISS_PRED misses it.
// The fallback asks the app for its top modal and the screen showing in it, and taps a header button
// of that screen only. That screen's title must be non-empty and name exactly one navigation bar, or
// nothing is tapped. Then:
// - one the app draws (a React view): exactly one pressable under that screen labelled exactly the
//   label, measured by the app, matched to the one button element of its size, left edge and top
//   (the measured top plus that bar's top, the modal window's), in the header band (measuredButtonAmong);
// - a native bar item (a modal's Cancel on iOS), which the app cannot measure: the button so labelled
//   inside that bar.
// Cancel, else Close, and Done only when the screen has neither (a Done can commit a modal's edits).
// A tap counts only when the top modal then leaves the app's modal stack (else the back/pop path
// runs, and escapeToTabs fails loudly if nothing works). Only the label is logged, never the title.
const HEADER_DISMISS_LABELS = ['Cancel', 'Close', 'Done'] as const

// The top modal's showing screen: its title, its route key, and for each label how many pressables
// under it carry exactly that label (-1 when one has no view to measure).
type TopModalScreen = {counts: Record<string, number>; title: string; topKey: string}

// Reads the top modal's showing screen for every label at once, and starts measuring each label's
// one pressable into globalThis.__e2eHeaderFrames[label]. null when no modal is up. Each call's
// measures write to its own frames object, so one still pending from an earlier call lands nowhere.
const topModalScreenBody = (labels: ReadonlyArray<string>) => `${fiberPrelude}
  const g = globalThis
  const frames = {}
  g.__e2eHeaderFrames = frames
  const router = kbModule('constants/router.tsx')
  const top = router.getModalStack().at(-1)
  const visible = router.getVisibleScreen()
  if (!top || !visible) return null
  const labels = ${JSON.stringify(labels)}
  const counts = {}
  for (const l of labels) counts[l] = 0
  const isScene = f => f.memoizedProps && f.memoizedProps.descriptor && f.memoizedProps.descriptor.route
  let scene
  const stack = [e2eRootFiber()]
  while (stack.length && !scene) {
    const f = stack.pop()
    if (f.key === visible.key && isScene(f)) scene = f
    if (f.sibling) stack.push(f.sibling)
    if (f.child) stack.push(f.child)
  }
  let underTop = !!scene && visible.key === top.key
  for (let p = scene && scene.return; p && !underTop; p = p.return) if (p.key === top.key && isScene(p)) underTop = true
  if (!underTop) return {counts, title: '', topKey: top.key}
  const options = scene.memoizedProps.descriptor.options || {}
  const title = typeof options.title === 'string' ? options.title : ''
  const hits = {}
  for (const l of labels) hits[l] = []
  const inner = scene.child ? [scene.child] : []
  while (inner.length) {
    const f = inner.pop()
    const p = f.memoizedProps
    const handler = p && (typeof p.onPress === 'function' ? p.onPress : typeof p.onClick === 'function' ? p.onClick : undefined)
    if (f.tag !== 5 && handler) {
      for (const l of labels) {
        if ((p.children === l || p.label === l || p.title === l) && !hits[l].some(h => h.handler === handler)) hits[l].push({f, handler})
      }
    }
    if (f.sibling) inner.push(f.sibling)
    if (f.child) inner.push(f.child)
  }
  for (const l of labels) {
    const hosts = hits[l].map(h => e2eHostOf(h.f)).filter(Boolean)
    counts[l] = hits[l].length === hosts.length ? hits[l].length : -1
    if (hits[l].length === 1 && hosts.length === 1) {
      g.nativeFabricUIManager.measureInWindow(hosts[0].stateNode.node, (x, y, width, height) => (frames[l] = {height, width, x, y}))
    }
  }
  return {counts, title, topKey: top.key}
`

const modalStillUp = async (key: string) =>
  jsEval<boolean>(`return kbModule('constants/router.tsx').getModalStack().some(r => r.key === ${JSON.stringify(key)})`)

// The app's measured frame of `label`'s one pressable, or undefined when it never arrives.
const measuredHeaderFrame = async (label: string) =>
  waitFor(
    `the "${label}" header button measured`,
    async () => (await jsEval<Rect | null>(`return (globalThis.__e2eHeaderFrames || {})[${JSON.stringify(label)}] || null`)) ?? undefined,
    {interval: 100, timeout: 3000}
  ).catch((e: unknown) => {
    if (isAttemptOver(e)) throw e
    return undefined
  })

// The header button element to tap for `label` on the top modal's screen, or undefined. Either way
// the screen's title must be non-empty and name exactly one navigation bar: the top modal's own.
async function topModalHeaderButton(label: string, screenInfo: TopModalScreen) {
  const count = screenInfo.counts[label] ?? 0
  if (!screenInfo.title || count < 0 || count > 1) return undefined
  const bars: Array<WebdriverIO.Element> = []
  for (const bar of await browser.$$('//XCUIElementTypeNavigationBar').getElements()) {
    if ((await bar.getAttribute('name').catch(() => null)) === screenInfo.title) bars.push(bar)
  }
  if (bars.length !== 1) return undefined
  const bar = bars[0]!
  const screen = await browser.getWindowRect()
  const byLabel = `-ios predicate string:type == "XCUIElementTypeButton" AND label == "${label}"`
  if (count === 1) {
    // drawn by the app: at its measured frame, placed on screen by the modal window's top (its bar's top)
    const measured = await measuredHeaderFrame(label)
    const barRect = await bar.getElementRect(bar.elementId).catch(() => undefined)
    if (!measured || !barRect) return undefined
    const buttons = await browser.$$(byLabel).getElements()
    const rects: Array<Rect> = []
    for (const b of buttons) rects.push(await b.getElementRect(b.elementId).catch(() => ({height: 0, width: 0, x: -1, y: -1})))
    const at = measuredButtonAmong(measured, rects, screen, barRect.y)
    return at === undefined ? undefined : buttons[at]
  }
  // a native bar item: the one so labelled inside that bar
  const inBar = await bar.$$(byLabel).getElements()
  if (inBar.length !== 1) return undefined
  const r = await inBar[0]!.getElementRect(inBar[0]!.elementId).catch(() => undefined)
  return r && onScreen(r, screen) && r.y + r.height <= HEADER_BAND ? inBar[0] : undefined
}

// One read of the app for every label; a harness error (attempt over, no inspector page) is thrown,
// never read as "no modal".
async function dismissStackedModal(alive: () => void): Promise<boolean> {
  const screenInfo = await jsEval<TopModalScreen | null>(topModalScreenBody(HEADER_DISMISS_LABELS))
  if (!screenInfo) return false
  for (const label of HEADER_DISMISS_LABELS) {
    const ctrl = await topModalHeaderButton(label, screenInfo)
    if (!ctrl) continue
    alive()
    console.log(`  escapeToTabs: dismissing a stacked modal with its "${label}"`)
    await ctrl.click().catch(() => {})
    const gone = async () => !(await modalStillUp(screenInfo.topKey))
    await waitFor('the stacked modal to leave', async () => ((await gone()) ? true : undefined), {interval: 100, timeout: 3000}).catch(
      (e: unknown) => {
        if (isAttemptOver(e)) throw e
      }
    )
    return gone()
  }
  return false
}

// The navigation bar button to back out of the screen on top: a Cancel or Close in any bar, else a
// Back (never a bar's submit, Save or Done); among those a visible one, else the lowest (a modal
// sheet's bar sits below a page's, and the tree keeps the bars of the screens under a modal, in no
// fixed order). Undefined when there is none. Bound: the reads 2.
export const barButton = async () => {
  const pick = async (labels: ReadonlyArray<string>) => {
    const found: Array<{e: WebdriverIO.Element; visible: boolean; y: number}> = []
    for (const label of labels) {
      for (const e of await browser
        .$$(`-ios class chain:**/XCUIElementTypeNavigationBar/XCUIElementTypeButton[\`label == "${label}"\`]`)
        .getElements()) {
        const y = (await e.getLocation().catch(() => undefined))?.y ?? -1
        found.push({e, visible: (await e.getAttribute('visible').catch(() => null)) === 'true', y})
      }
    }
    return (found.find(f => f.visible) ?? [...found].sort((p, q) => q.y - p.y)[0])?.e
  }
  return (await pick(['Cancel', 'Close'])) ?? (await pick(['Back']))
}

// A modal whose bar buttons XCUITest reports invisible (the add-members wizard's steps) has no
// DISMISS_PRED match, and the stacked-modal fallback wants its title on the bar. While the app's modal
// stack is not empty, this clicks barButton's pick. It counts only when the app's top route then
// changes. Bound: the route read 10 (one eval), barButton 2, the click 1, 3s of route reads overrun by
// one 10 = 26, inside escapeToTabs' deadline.
const topRouteKey = async () =>
  jsEval<string | null>(`const r = kbModule('constants/router.tsx'); return r.getModalStack().length ? (r.getVisibleScreen() || {}).key || null : null`)
async function dismissModalByBar(alive: () => void): Promise<boolean> {
  const before = await topRouteKey()
  if (!before) return false
  const button = await barButton()
  if (!button) return false
  alive()
  console.log('  escapeToTabs: dismissing a modal by its bar button')
  await button.click().catch(() => {})
  return waitFor('the modal to move', async () => ((await topRouteKey()) !== before ? true : undefined), {interval: 150, timeout: 3000}).then(
    () => true,
    (e: unknown) => {
      if (isAttemptOver(e)) throw e
      return false
    }
  )
}

// Bound: 30s, a hard deadline (no step starts after it), so a slow inspector read or a run of hops
// cannot outlast the sums that count it as 30.
const ESCAPE_MS = 30_000
export const escapeToTabs = async (): Promise<void> => underDeadline('escapeToTabs', ESCAPE_MS, escapeHops)

async function escapeHops(alive: () => void): Promise<void> {
  // A flow may end with the keyboard up (chat input, crypto, feedback); it can
  // cover tappable UI on the next test, so dismiss it before resetting.
  await dismissKeyboard()
  // Android: one back affordance for everything (modals, sheets, pushed screens
  // all pop on the hardware back), so just press back until we're at a tab root.
  // atTabs is checked first so we never press back AT the root (which would
  // background/exit the app).
  if (browser.isAndroid) {
    for (let i = 0; i < 12; i++) {
      alive()
      // A back pressed AT the root exits the app (screens can also settle slower
      // than the wait below, making the loop overshoot) — if that happened,
      // bring the existing task back to the foreground instead of pressing
      // back on the launcher. activateApp moves the running process forward;
      // it does NOT relaunch it (a relaunch would reload from Metro and can
      // land on a dead blank RN root).
      const pkg = await browser.getCurrentPackage().catch(() => '')
      if (pkg && pkg !== 'io.keybase.ossifrage') {
        alive()
        await browser.activateApp('io.keybase.ossifrage').catch(() => {})
        await browser.waitUntil(async () => atTabs(), {timeout: 5000, interval: 250}).catch(() => {})
        continue
      }
      if (await atTabs()) return
      alive()
      await browser.back()
      // Short fixed settle for the pop animation, then loop back to the atTabs
      // check (itself a slow full-tree query, adding natural pacing). A back
      // pressed one screen too early is recovered by the foreground guard above,
      // so a long per-hop wait would only tax multi-hop resets.
      await browser.pause(800)
    }
    throw new Error('escapeToTabs(android): root tab bar not reached after 12 attempts')
  }
  for (let i = 0; i < 10; i++) {
    alive()
    if (await atTabs()) return
    // Past the first few hops something is off — narrate each step so a stall
    // is diagnosable from the console instead of looking like a silent hang.
    const debug = i >= 3
    // Dismiss a modal/sheet FIRST (e.g. the crypto output modal). A modal can
    // also have a back button, and tapping back on it is a no-op that loops —
    // so its Done/Close/Cancel must win.
    if ((await browser.$$(DISMISS_PRED).length) > 0) {
      const ctrl = browser.$$(DISMISS_PRED)[0]!
      if (debug) console.log(`  escapeToTabs[${i}]: dismissing "${await ctrl.getAttribute('label').catch(() => '?')}"`)
      alive()
      await ctrl.click().catch(() => {})
      await settleAfter(ctrl)
      // Only loop when the click actually changed something; a dismiss control
      // whose click no-ops (still present, still not at tabs) must fall through
      // to the back/pop path or we'd click it forever.
      if ((await atTabs()) || !(await ctrl.isExisting().catch(() => false))) continue
      if (debug) console.log(`  escapeToTabs[${i}]: dismiss no-oped, falling through to back/pop`)
    } else if (await dismissStackedModal(alive)) {
      continue
    } else if (await dismissModalByBar(alive)) {
      continue
    } else if (debug) {
      console.log(`  escapeToTabs[${i}]: no dismiss control, trying back/pop`)
    }
    if ((await els(T.COMMON_BACK_BUTTON).length) > 0) {
      const ctrl = els(T.COMMON_BACK_BUTTON)[0]!
      alive()
      await ctrl.click().catch(() => {})
      await settleAfter(ctrl)
      continue
    }
    if ((await els('BackButton').length) > 0) {
      const ctrl = els('BackButton')[0]!
      alive()
      await ctrl.click().catch(() => {})
      await settleAfter(ctrl)
      continue
    }
    // Native nav-bar back whose name varies by iOS version (e.g. "loggedIn" on
    // iOS 16.4) — match it by position instead. Must come before the edge-swipe:
    // the left-edge pop gesture does not reliably pop on older iOS here.
    if (await tapNavBack(false, alive)) {
      await browser.waitUntil(async () => atTabs(), {timeout: 1500, interval: 80}).catch(() => {})
      continue
    }
    // No back button visible — try the iOS pop gesture (swipe from left edge).
    const {width, height} = await browser.getWindowRect()
    alive()
    await browser
      .action('pointer')
      .move({x: 3, y: Math.round(height / 2)})
      .down()
      .move({x: Math.round(width * 0.85), y: Math.round(height / 2), duration: 250})
      .up()
      .perform()
    await browser.waitUntil(async () => atTabs(), {timeout: 1500, interval: 80}).catch(() => {})
  }
  // Failing loudly here beats letting the NEXT test fail confusingly on a
  // screen it never expected to start from.
  throw new Error('escapeToTabs: root tab bar not reached after 10 attempts')
}

// Pop one screen. Like escapeToTabs's step but a single hop: app testID
// "backButton" if present, else the native nav "BackButton", else the iOS
// left-edge pop gesture. Use this for in-flow back navigation instead of
// clicking COMMON_BACK_BUTTON directly (inner native screens lack that testID).
export async function goBack(): Promise<void> {
  // Android: hardware back pops the current screen — but if a keyboard is up
  // (e.g. the Feedback input auto-focuses), the first back only dismisses the
  // keyboard and the screen stays. Hide it first so back actually pops.
  if (browser.isAndroid) {
    await dismissKeyboard()
    await browser.back()
    return
  }
  // .catch on the clicks: between the length check and the click the button can
  // go stale (slow old sims re-render mid-pop), which would otherwise throw an
  // unhandled "element wasn't found". Swallowing it leaves goBack a no-op that
  // goBackUntilGone's retry loop recovers, instead of failing the whole flow.
  if ((await els(T.COMMON_BACK_BUTTON).length) > 0) {
    await els(T.COMMON_BACK_BUTTON)[0]!.click().catch(() => {})
    return
  }
  if ((await els('BackButton').length) > 0) {
    await els('BackButton')[0]!.click().catch(() => {})
    return
  }
  // Native nav back whose name varies by iOS version (e.g. "loggedIn" on iOS
  // 16.4). Guard to a true left-edge chevron so the iPad split conversation
  // pane's mid-screen nav button isn't mistaken for back.
  if (await tapNavBack(true)) return
  const {width, height} = await browser.getWindowRect()
  await browser
    .action('pointer')
    .move({x: 3, y: Math.round(height / 2)})
    .down()
    .move({x: Math.round(width * 0.85), y: Math.round(height / 2), duration: 250})
    .up()
    .perform()
}

// goBack, retried until a marker testID from the screen being popped is gone.
// A single goBack can no-op on slow/old sims (the back tap is swallowed, or the
// left-edge guard rejects an oddly-positioned chevron), leaving the caller on
// the old screen so the next tap lands wrong. Verifying the pop via the marker's
// disappearance makes back navigation reliable. Returns once gone (or after
// `tries` attempts — caller's next wait then surfaces a real failure).
export async function goBackUntilGone(markerId: string, tries = 3): Promise<void> {
  for (let i = 0; i < tries; i++) {
    await goBack()
    const gone = await browser
      .waitUntil(async () => (await els(markerId).length) === 0, {timeout: 3000, interval: 150})
      .then(() => true)
      .catch(() => false)
    if (gone) return
  }
}

// The iOS tab bar is a NATIVE UITabBar: testIDs (nav-tab-*) do not reach the
// native UITabBarItems, but their titles do (exposed as the accessibility
// name/label). So tabs are tapped by visible label, not testID.
// Tab taps aren't idle-synchronized (waitForIdleTimeout is 0), so a tap can
// land mid tab-switch and silently no-op — verify the destination marker and
// re-tap when it doesn't show.
export async function tabTo(label: string, markerId: string, {taps = 3, timeout = 4000} = {}): Promise<void> {
  for (let i = 0; i < taps; i++) {
    await tab(label).click().catch(() => {})
    const ok = await el(markerId)
      .waitForExist({timeout, interval: 150})
      .then(() => true)
      .catch(() => false)
    if (ok) return
  }
  throw new Error(`tabTo: "${markerId}" never appeared after ${taps} taps on tab "${label}"`)
}

export async function navigateToPeople(): Promise<void> {
  await tabTo('People', T.PEOPLE_FEED)
}

export async function navigateToChat(): Promise<void> {
  await tabTo('Chat', T.CHAT_INBOX_LIST)
}

export async function navigateToFiles(): Promise<void> {
  await tabTo('Files', T.FILES_BROWSER)
}

export async function navigateToTeams(): Promise<void> {
  await tabTo('Teams', T.TEAMS_LIST)
}

// The "More" tab surfaces Crypto / Git / Devices / Settings under its stack.
export async function navigateToMore(): Promise<void> {
  await tab('More').click()
  // The More tab keeps its own nav stack: a prior flow (crypto/git/devices) can
  // leave it on a pushed sub-screen, so the first tap just refocuses the tab
  // without reaching settings root. Re-tapping the already-focused tab pops its
  // stack to the top. Retry until the settings root marker shows.
  for (let i = 0; i < 3; i++) {
    if (
      await el(T.SETTINGS_ACCOUNT)
        .waitForExist({timeout: 2500, interval: 150})
        .then(() => true)
        .catch(() => false)
    )
      return
    await tab('More').click()
  }
  await waitForTestID(T.SETTINGS_ACCOUNT, 5000)
}

// A tab's root, from wherever the app is: back to the tabs, the tab tapped until `rootTestID` shows,
// and its root screen `screen` checked. Bound: escapeToTabs 30, tabTo 15 (three taps and 4s waits),
// the screen 11 = 56.
export const openTabRoot = async (tabName: string, rootTestID: string, screen: string) => {
  await escapeToTabs()
  await tabTo(tabName, rootTestID)
  await expectScreen(`the ${tabName} tab's root`, screen)
}

// `back` (once a try, only while the screen up is not it) until the screen up is `name` with params
// `ok` takes. Bound: 30s of tries, overrun by one (the back, the screen 5 and its read 1).
export const backUntil = async (
  what: string,
  name: string,
  ok: (params: Record<string, unknown>) => boolean,
  back: () => Promise<unknown>
) =>
  retriedNavigation(
    what,
    async () => {
      const s = await visibleScreen()
      if (!(s?.name === name && ok(s.params ?? {}))) await back()
      await expectScreen(what, name, ok, 5_000)
    },
    {intervals: [500], timeout: 30_000}
  )
