import {test, expect, type Page} from '@playwright/test'
import {connectToElectron, disconnect} from '@/tests/e2e/electron/helpers/connect'
import {navigateToTeams} from '@/tests/e2e/electron/helpers/navigate'
import {TEAMS_LIST, TEAMS_ROW} from '@/tests/e2e/shared/test-ids'

let page: Page

test.beforeAll(async () => {
  ;({page} = await connectToElectron())
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
  await expect(page.getByTestId(TEAMS_LIST)).not.toBeVisible({timeout: 3_000})
})
