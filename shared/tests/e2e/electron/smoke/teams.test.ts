import {test, expect, type Page} from '@playwright/test'
import {connectToElectron, disconnect} from '@/tests/e2e/electron/helpers/connect'
import {navigateToTeams} from '@/tests/e2e/electron/helpers/navigate'
import {TEAMS_LIST} from '@/tests/e2e/shared/test-ids'

let page: Page

test.beforeAll(async () => {
  ;({page} = await connectToElectron())
})

test.afterAll(async () => {
  await disconnect()
})

test('teams tab renders', async () => {
  await navigateToTeams(page)
  await expect(page.getByTestId(TEAMS_LIST)).toBeVisible()
})
