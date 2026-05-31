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
