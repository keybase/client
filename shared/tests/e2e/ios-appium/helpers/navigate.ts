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

// True once the native tab bar (root) is on screen.
async function atTabs(): Promise<boolean> {
  return (await els('People').length) > 0
}

// Dismiss the keyboard ONLY when one is present — calling mobile: hideKeyboard
// with no keyboard up hangs until timeout. The keyboard (raised by chat/crypto/
// feedback inputs) can cover tappable UI on later screens.
export async function dismissKeyboard(): Promise<void> {
  // isKeyboardShown is a direct Appium endpoint (fast) — avoid an
  // //XCUIElementTypeKeyboard xpath, which is a slow full-tree search per call.
  if (await browser.isKeyboardShown().catch(() => false)) {
    await browser.execute('mobile: hideKeyboard').catch(() => {})
  }
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
  if ((await els(T.COMMON_BACK_BUTTON).length) > 0) {
    await els(T.COMMON_BACK_BUTTON)[0]!.click()
    return
  }
  if ((await els('BackButton').length) > 0) {
    await els('BackButton')[0]!.click()
    return
  }
  const {width, height} = await browser.getWindowRect()
  await browser
    .action('pointer')
    .move({x: 3, y: Math.round(height / 2)})
    .down()
    .move({x: Math.round(width * 0.85), y: Math.round(height / 2), duration: 250})
    .up()
    .perform()
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
  await waitForTestID(T.SETTINGS_ACCOUNT, 5000)
}
