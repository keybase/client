import type {Page} from '@playwright/test'
import * as T from '@/tests/e2e/shared/test-ids'

async function clickNavTab(page: Page, tabTestID: string): Promise<void> {
  await page.click(`[data-testid="${tabTestID}"]`)
}

export async function navigateToChat(page: Page): Promise<void> {
  await clickNavTab(page, T.NAV_TAB_CHAT)
  await page.waitForSelector(`[data-testid="${T.CHAT_INBOX_LIST}"]`, {timeout: 5_000})
}

export async function navigateToTeams(page: Page): Promise<void> {
  // Teams nav tab becomes non-actionable when the desktop header's WebkitAppRegion:drag
  // region is active (e.g. when a team detail is open). force:true lets the click through,
  // which triggers jumpTo to reset the tab stack back to teamsRoot.
  await page.click(`[data-testid="${T.NAV_TAB_TEAMS}"]`, {force: true})
  try {
    await page.waitForSelector(`[data-testid="${T.TEAMS_LIST}"]`, {timeout: 3_000})
  } catch {
    await page.click(`[data-testid="${T.NAV_TAB_TEAMS}"]`, {force: true})
    await page.waitForSelector(`[data-testid="${T.TEAMS_LIST}"]`, {timeout: 5_000})
  }
}

// Opens the first inbox conversation and waits for the message list.
// Returns false when the inbox is empty (caller should test.skip()).
export async function openFirstConversation(page: Page): Promise<boolean> {
  await navigateToChat(page)
  const rows = page.getByTestId(T.CHAT_INBOX_ROW)
  if ((await rows.count()) === 0) return false
  await rows.first().click()
  await page.waitForSelector(`[data-testid="${T.CHAT_MESSAGE_LIST}"]`, {timeout: 5_000})
  return true
}

// Opens inbox conversations top-down until `check` passes for one of them.
// Returns false when no conversation matches (caller should test.skip()).
export async function openConversationMatching(
  page: Page,
  check: (page: Page) => Promise<boolean>,
  maxRows = 5
): Promise<boolean> {
  await navigateToChat(page)
  const rows = page.getByTestId(T.CHAT_INBOX_ROW)
  const n = Math.min(await rows.count(), maxRows)
  for (let i = 0; i < n; i++) {
    await rows.nth(i).click()
    await page.waitForSelector(`[data-testid="${T.CHAT_MESSAGE_LIST}"]`, {timeout: 5_000})
    // let messages land before probing
    await page.waitForTimeout(500)
    if (await check(page)) return true
  }
  return false
}

// Opens own profile via the "Hi user!" menu and dismisses the menu popup.
export async function openOwnProfile(page: Page): Promise<void> {
  const smokeUser = process.env['KB_SMOKE_USER']
  await page.click(`[data-testid="${T.NAV_TAB_PEOPLE}"]`)
  await page.click(`text=Hi ${smokeUser}!`)
  await page.click('text=View/Edit profile')
  await page.waitForSelector(`[data-testid="${T.PROFILE_PAGE}"]`, {timeout: 10_000})
  // dismiss the still-open account-switcher menu (Escape first, outside click as fallback)
  await page.keyboard.press('Escape')
  try {
    await page.waitForSelector('text=View/Edit profile', {state: 'hidden', timeout: 2_000})
  } catch {
    await page.mouse.click(700, 300)
    await page.waitForSelector('text=View/Edit profile', {state: 'hidden', timeout: 5_000})
  }
}

export async function navigateToFiles(page: Page): Promise<void> {
  await clickNavTab(page, T.NAV_TAB_FILES)
  await page.waitForSelector(`[data-testid="${T.FILES_BROWSER}"]`, {timeout: 5_000})
}

export async function navigateToDevices(page: Page): Promise<void> {
  await clickNavTab(page, T.NAV_TAB_DEVICES)
  await page.waitForSelector(`[data-testid="${T.DEVICES_LIST}"]`, {timeout: 5_000})
}

export async function navigateToSettings(page: Page): Promise<void> {
  await clickNavTab(page, T.NAV_TAB_SETTINGS)
  await page.waitForSelector(`[data-testid="${T.SETTINGS_ACCOUNT}"]`, {timeout: 5_000})
}

export async function navigateToPeople(page: Page): Promise<void> {
  await clickNavTab(page, T.NAV_TAB_PEOPLE)
  await page.waitForSelector(`[data-testid="${T.PEOPLE_FEED}"]`, {timeout: 5_000})
}

export async function navigateToCrypto(page: Page): Promise<void> {
  await clickNavTab(page, T.NAV_TAB_CRYPTO)
  await page.waitForSelector(`[data-testid="${T.CRYPTO_INPUT}"]`, {timeout: 5_000})
}

export async function navigateToGit(page: Page): Promise<void> {
  await clickNavTab(page, T.NAV_TAB_GIT)
  await page.waitForSelector(`[data-testid="${T.GIT_REPO_LIST}"]`, {timeout: 5_000})
}
