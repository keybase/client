import {test, expect, type Browser, type Page} from '@playwright/test'
import {connectToElectron, disconnect} from '../helpers/connect'
import {navigateToTeams} from '../helpers/navigate'
import {TEAMS_LIST, TEAMS_ROW} from '../../shared/test-ids'

let browser: Browser
let page: Page

test.beforeAll(async () => {
  ;({browser, page} = await connectToElectron())
})

test.afterAll(async () => {
  await disconnect()
})

test('teams list renders', async () => {
  await navigateToTeams(page)
  await expect(page.getByTestId(TEAMS_LIST)).toBeVisible()
})

test('can open a team if one exists', async () => {
  await navigateToTeams(page)
  const rows = page.getByTestId(TEAMS_ROW)
  const count = await rows.count()
  if (count === 0) {
    test.skip()
    return
  }
  await rows.first().click()
  // After clicking, the teams list should no longer be visible (navigated into team)
  await expect(page.getByTestId(TEAMS_LIST)).not.toBeVisible({timeout: 5_000})
})
