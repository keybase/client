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
