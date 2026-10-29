import {expect, type Page} from '@playwright/test'
import escapeRegExp from 'lodash/escapeRegExp'
import {loadE2EAccounts} from '@/tests/e2e/accounts/env'
import * as T from '@/tests/e2e/shared/test-ids'
import {openMenu} from './menu'
import {retriedNavigation} from './step'

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

// A team page's title, the team's name in the page header (a list row's name is in another style).
const teamPageTitle = (page: Page, name: string) =>
  page
    .locator('.text_Header')
    .filter({hasText: new RegExp(`^${escapeRegExp(name)}$`)})
    .locator('visible=true')
    .first()

// Opens KB_E2E_TEAM's page, found by name: the smoke account is in other teams that are not the
// tests' to act on, so no flow opens a team by its place in the list.
export async function openE2ETeam(page: Page): Promise<void> {
  await openTeamPage(page, loadE2EAccounts().team, 'the e2e team (KB_E2E_TEAM)')
}

// Opens a subteam of KB_E2E_TEAM by its full name, from the e2e team's Subteams tab (the teams
// list can go on without a team made moments earlier); `what` names it in a failure.
export async function openE2ESubteam(page: Page, name: string, what: string): Promise<void> {
  const {team} = loadE2EAccounts()
  if (!name.startsWith(`${team}.`)) throw new Error(`${what} is not a subteam of the e2e team`)
  const row = page.getByTestId(T.TEAMS_ROW).filter({has: page.getByText(name, {exact: true})}).locator('visible=true').first()
  await retriedNavigation(`${what}: its team page`, async () => {
    await teamPageOnce(page, team, 'the e2e team (KB_E2E_TEAM)')
    await page.getByTestId(T.TEAMS_TAB_SUBTEAMS_BUTTON).locator('visible=true').first().click({timeout: 5_000})
    await expect(row, `${what} in the e2e team's subteams`).toBeVisible({timeout: 10_000})
    await row.click({timeout: 5_000})
    await expect(row, `${what}: its team page, over the subteams list`).toBeHidden({timeout: 5_000})
    await expect(teamPageTitle(page, name), `${what}: the opened team page names it`).toBeVisible({timeout: 5_000})
  }, {intervals: [1_000], timeout: 90_000})
}

// Opens a subteam of KB_E2E_TEAM from the teams list, where it shows for an account that is in it
// (the second account sees no Subteams tab on the e2e team); `what` names it in a failure.
export async function openE2ESubteamFromList(page: Page, name: string, what: string): Promise<void> {
  if (!name.startsWith(`${loadE2EAccounts().team}.`)) throw new Error(`${what} is not a subteam of the e2e team`)
  await openTeamPage(page, name, what)
}

// The list can still be moving when its row comes into view (the wheel, rows loading in), and a
// click then lands on whichever row moved under the pointer: the page that opens has to name the
// team, or the list is opened again and the row clicked again.
async function openTeamPage(page: Page, name: string, what: string): Promise<void> {
  await retriedNavigation(`${what}: its team page`, async () => teamPageOnce(page, name, what), {intervals: [500], timeout: 60_000})
}

// One try at opening a team's page from the teams list, for a caller's retry loop.
async function teamPageOnce(page: Page, name: string, what: string): Promise<void> {
  const rows = page.getByTestId(T.TEAMS_ROW)
  const row = rows.filter({has: page.getByText(name, {exact: true})}).first()
  await navigateToTeams(page)
  await expect(rows.first(), 'the teams list to load').toBeVisible({timeout: 10_000})
  // the list renders only the rows near what it shows, and keeps where it was scrolled: from its
  // top, scroll down until the team's row is in
  await page.getByTestId(T.TEAMS_LIST).hover()
  await page.mouse.wheel(0, -100_000)
  const deadline = Date.now() + 20_000
  while (!(await row.isVisible())) {
    if (Date.now() > deadline) throw new Error(`${what} is not in the teams list (scrolled for 20s)`)
    await page.mouse.wheel(0, 400)
    await page.waitForTimeout(100)
  }
  await page.waitForTimeout(300)
  await row.click()
  await expect(rows.first(), `${what}: its team page to open`).toBeHidden({timeout: 5_000})
  await expect(teamPageTitle(page, name), `${what}: the opened team page names it`).toBeVisible({timeout: 5_000})
}

// Opens own profile from the "Hi user!" menu. The menu opens through openMenu: a pick within the
// popup's debounce of its show leaves the menu open over the app.
export async function openOwnProfile(page: Page): Promise<void> {
  const {smokeUser} = loadE2EAccounts()
  // from the People feed, whatever profile an earlier test left stacked on it
  await navigateToPeople(page)
  const item = page.getByText('View/Edit profile', {exact: true})
  await openMenu(page, page.getByText(`Hi ${smokeUser}!`, {exact: true}), item, 'the user menu')
  await item.click({timeout: 5_000})
  await page.waitForSelector(`[data-testid="${T.PROFILE_PAGE}"]`, {timeout: 10_000})
  await expect(item, 'the user menu after the pick').toBeHidden({timeout: 5_000})
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

// The People tab keeps its stack: a profile opened from it stays on top of the feed, so it is backed
// out of with the header's back arrow.
export async function navigateToPeople(page: Page): Promise<void> {
  await clickNavTab(page, T.NAV_TAB_PEOPLE)
  const feed = page.getByTestId(T.PEOPLE_FEED).locator('visible=true')
  const profile = page.getByTestId(T.PROFILE_PAGE).locator('visible=true')
  await expect(feed.or(profile).first(), 'the People tab').toBeVisible({timeout: 5_000})
  for (let depth = 0; depth < 5 && (await profile.count()) > 0; depth++) {
    await page.locator('.icon-gen-iconfont-arrow-left').locator('visible=true').first().click({timeout: 5_000})
    await expect(feed.or(profile).first(), 'the People tab after back').toBeVisible({timeout: 5_000})
  }
  await expect(feed, 'the people feed').toBeVisible({timeout: 5_000})
}

export async function navigateToCrypto(page: Page): Promise<void> {
  await clickNavTab(page, T.NAV_TAB_CRYPTO)
  await page.waitForSelector(`[data-testid="${T.CRYPTO_INPUT}"]`, {timeout: 5_000})
}

export async function navigateToGit(page: Page): Promise<void> {
  await clickNavTab(page, T.NAV_TAB_GIT)
  await page.waitForSelector(`[data-testid="${T.GIT_REPO_LIST}"]`, {timeout: 5_000})
}

export type FocusedRoute = {names: Array<string>; params: unknown}

// The main window's focused route chain, outermost first, and the focused screen's params, read
// off the dev app's navigation container (router-v2/router.tsx).
export const focusedRoute = async (page: Page): Promise<FocusedRoute> =>
  page.evaluate(() => {
    type Route = {name?: string; params?: unknown; state?: State}
    type State = {index?: number; routes?: Array<Route>}
    type Nav = {getRootState: () => State}
    const g = globalThis as unknown as {DEBUGRouter2?: {navigationRef?: {current?: Nav | null}}; DEBUGNavigator?: Nav}
    const nav = g.DEBUGRouter2?.navigationRef?.current ?? g.DEBUGNavigator
    if (!nav) throw new Error('the app has no navigation container on DEBUGRouter2; is this a dev build?')
    const names: Array<string> = []
    let params: unknown
    let s: State | undefined = nav.getRootState()
    while (s?.routes?.length) {
      const r: Route | undefined = s.routes[s.index ?? s.routes.length - 1]
      if (!r) break
      if (r.name) names.push(r.name)
      params = r.params
      s = r.state
    }
    return {names, params}
  })
