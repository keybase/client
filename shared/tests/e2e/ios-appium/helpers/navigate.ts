import type {ChainablePromiseElement} from 'webdriverio'
import * as T from '../../shared/test-ids'
import {byText, els, waitForTestID, tab} from './elements'

// Swipe up (content moves up) until text is on screen, for items below the fold.
// iOS XCUITest prunes off-screen views, so byText can't find them until scrolled.
export async function scrollDownToText(text: string, maxSwipes = 6): Promise<void> {
  for (let i = 0; i < maxSwipes; i++) {
    if (await byText(text).isExisting()) return
    const {width, height} = await browser.getWindowRect()
    await browser
      .action('pointer')
      .move({x: Math.round(width / 2), y: Math.round(height * 0.7)})
      .down()
      .move({x: Math.round(width / 2), y: Math.round(height * 0.3), duration: 300})
      .up()
      .perform()
    // Detect the target appearing rather than sleeping a fixed amount.
    await browser.waitUntil(async () => byText(text).isExisting(), {timeout: 800, interval: 100}).catch(() => {})
  }
}

// True once the native tab bar (root) is on screen.
async function atTabs(): Promise<boolean> {
  return (await els('People').length) > 0
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
