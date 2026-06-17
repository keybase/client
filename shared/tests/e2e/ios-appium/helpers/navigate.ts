import type {ChainablePromiseElement} from 'webdriverio'
import * as T from '../../shared/test-ids'
import {byText, el, els, waitForTestID, tab} from './elements'

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

export async function scrollToTestID(id: string, maxSwipes = 8): Promise<void> {
  await scrollUpUntil(async () => el(id).isDisplayed().catch(() => false), maxSwipes)
}

export async function scrollDownToText(text: string, maxSwipes = 8): Promise<void> {
  await scrollUpUntil(async () => byText(text).isDisplayed().catch(() => false), maxSwipes)
}

// True once we're at the root of a tab. The tab bar alone isn't proof: on iPad
// it stays visible inside pushed stack screens, so also require that no back
// button (app-custom or native) is present.
async function atTabs(): Promise<boolean> {
  if (browser.isAndroid) {
    // Android tab labels are text/content-desc, not resource-id testIDs, so use
    // tab() (byText) not els(). At a tab root the People tab shows and there's
    // no app back button nor a native toolbar up-affordance.
    if (!(await tab('People').isExisting().catch(() => false))) return false
    if ((await els(T.COMMON_BACK_BUTTON).length) > 0) return false
    return (await browser.$$('//*[@content-desc="Navigate up" or @content-desc="Back"]').length) === 0
  }
  if ((await els('People').length) === 0) return false
  if ((await els(T.COMMON_BACK_BUTTON).length) > 0) return false
  return (await els('BackButton').length) === 0
}

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
async function tapNavBack(requireLeftEdge = false): Promise<boolean> {
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
const DISMISS_PRED =
  '-ios predicate string:label CONTAINS "Done" OR name CONTAINS "Done" OR label CONTAINS "Close" OR name CONTAINS "Close" OR label CONTAINS "Cancel" OR name CONTAINS "Cancel"'

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

export async function escapeToTabs(): Promise<void> {
  // A flow may end with the keyboard up (chat input, crypto, feedback); it can
  // cover tappable UI on the next test, so dismiss it before resetting.
  await dismissKeyboard()
  // Android: one back affordance for everything (modals, sheets, pushed screens
  // all pop on the hardware back), so just press back until we're at a tab root.
  // atTabs is checked first so we never press back AT the root (which would
  // background/exit the app).
  if (browser.isAndroid) {
    for (let i = 0; i < 12; i++) {
      if (await atTabs()) return
      await browser.back()
      await browser.waitUntil(async () => atTabs(), {timeout: 1500, interval: 80}).catch(() => {})
    }
    throw new Error('escapeToTabs(android): root tab bar not reached after 12 attempts')
  }
  for (let i = 0; i < 10; i++) {
    if (await atTabs()) return
    // Dismiss a modal/sheet FIRST (e.g. the crypto output modal). A modal can
    // also have a back button, and tapping back on it is a no-op that loops —
    // so its Done/Close/Cancel must win.
    if ((await browser.$$(DISMISS_PRED).length) > 0) {
      const ctrl = browser.$$(DISMISS_PRED)[0]!
      await ctrl.click().catch(() => {})
      await settleAfter(ctrl)
      continue
    }
    if ((await els(T.COMMON_BACK_BUTTON).length) > 0) {
      const ctrl = els(T.COMMON_BACK_BUTTON)[0]!
      await ctrl.click().catch(() => {})
      await settleAfter(ctrl)
      continue
    }
    if ((await els('BackButton').length) > 0) {
      const ctrl = els('BackButton')[0]!
      await ctrl.click().catch(() => {})
      await settleAfter(ctrl)
      continue
    }
    // Native nav-bar back whose name varies by iOS version (e.g. "loggedIn" on
    // iOS 16.4) — match it by position instead. Must come before the edge-swipe:
    // the left-edge pop gesture does not reliably pop on older iOS here.
    if (await tapNavBack()) {
      await browser.waitUntil(async () => atTabs(), {timeout: 1500, interval: 80}).catch(() => {})
      continue
    }
    // No back button visible — try the iOS pop gesture (swipe from left edge).
    const {width, height} = await browser.getWindowRect()
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
  if ((await els(T.COMMON_BACK_BUTTON).length) > 0) {
    await els(T.COMMON_BACK_BUTTON)[0]!.click()
    return
  }
  if ((await els('BackButton').length) > 0) {
    await els('BackButton')[0]!.click()
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
export async function navigateToPeople(): Promise<void> {
  await tab('People').click()
  await waitForTestID(T.PEOPLE_FEED, 5000)
}

export async function navigateToChat(): Promise<void> {
  await tab('Chat').click()
  await waitForTestID(T.CHAT_INBOX_LIST, 5000)
}

export async function navigateToFiles(): Promise<void> {
  await tab('Files').click()
  await waitForTestID(T.FILES_BROWSER, 5000)
}

export async function navigateToTeams(): Promise<void> {
  await tab('Teams').click()
  await waitForTestID(T.TEAMS_LIST, 3000)
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
