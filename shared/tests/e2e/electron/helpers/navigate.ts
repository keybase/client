import {expect, type Page} from '@playwright/test'
import {loadE2EAccounts} from '@/tests/e2e/accounts/env'
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

// Opens KB_E2E_TEAM's page, found by name: the smoke account is in other teams that are not the
// tests' to act on, so no flow opens a team by its place in the list.
export async function openE2ETeam(page: Page): Promise<void> {
  const {team} = loadE2EAccounts()
  await navigateToTeams(page)
  const rows = page.getByTestId(T.TEAMS_ROW)
  await expect(rows.first(), 'the teams list to load').toBeVisible({timeout: 10_000})
  const row = rows.filter({has: page.getByText(team, {exact: true})}).first()
  // the list renders only the rows near what it shows: scroll down until the team's row is in
  await page.getByTestId(T.TEAMS_LIST).hover()
  const deadline = Date.now() + 20_000
  while (!(await row.isVisible())) {
    if (Date.now() > deadline) throw new Error('the e2e team (KB_E2E_TEAM) is not in the teams list (scrolled for 20s)')
    await page.mouse.wheel(0, 400)
    await page.waitForTimeout(100)
  }
  await row.click()
  await expect(rows.first(), 'the e2e team page to open').toBeHidden({timeout: 5_000})
}

// Opens own profile via the "Hi user!" menu and dismisses the menu popup.
export async function openOwnProfile(page: Page): Promise<void> {
  const {smokeUser} = loadE2EAccounts()
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
