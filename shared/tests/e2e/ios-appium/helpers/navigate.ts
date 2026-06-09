import * as T from '../../shared/test-ids'
import {el, els, waitForTestID, tab} from './elements'

export async function escapeToTabs(): Promise<void> {
  for (let i = 0; i < 4; i++) {
    if ((await els(T.COMMON_BACK_BUTTON).length) === 0) break
    if (!(await el(T.COMMON_BACK_BUTTON).isDisplayed().catch(() => false))) break
    await el(T.COMMON_BACK_BUTTON).click()
    await browser.pause(300)
  }
  const {width, height} = await browser.getWindowRect()
  await browser
    .action('pointer')
    .move({x: Math.round(width / 2), y: Math.round(height * 0.3)})
    .down()
    .pause(100)
    .move({x: Math.round(width / 2), y: Math.round(height * 0.7), duration: 400})
    .up()
    .perform()
  await browser.pause(400)
}

export async function navigateToPeople(): Promise<void> {
  await tab(T.NAV_TAB_PEOPLE).click()
  await waitForTestID(T.PEOPLE_FEED, 5000)
}

export async function navigateToChat(): Promise<void> {
  await tab(T.NAV_TAB_CHAT).click()
  await waitForTestID(T.CHAT_INBOX_LIST, 5000)
}

export async function navigateToFiles(): Promise<void> {
  await tab(T.NAV_TAB_FILES).click()
  await waitForTestID(T.FILES_BROWSER, 5000)
}

export async function navigateToTeams(): Promise<void> {
  await tab(T.NAV_TAB_TEAMS).click()
  await waitForTestID(T.TEAMS_LIST, 3000)
}

// Tap the More tab (settingsTab, testID nav-tab-settings) to surface
// Crypto / Git / Devices / Settings — which live under the More stack.
export async function navigateToMore(): Promise<void> {
  await tab(T.NAV_TAB_SETTINGS).click()
  await waitForTestID(T.SETTINGS_ACCOUNT, 5000)
}
