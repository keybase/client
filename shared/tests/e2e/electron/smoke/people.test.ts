import {test, expect, type Page} from '@playwright/test'
import {connectToElectron, disconnect} from '@/tests/e2e/electron/helpers/connect'
import {navigateToPeople} from '@/tests/e2e/electron/helpers/navigate'
import {PEOPLE_FEED} from '@/tests/e2e/shared/test-ids'

let page: Page

test.beforeAll(async () => {
  ;({page} = await connectToElectron())
})

test.afterAll(async () => {
  await disconnect()
})

test('people tab renders', async () => {
  await navigateToPeople(page)
  await expect(page.getByTestId(PEOPLE_FEED)).toBeVisible()
})
