import {test, expect, type Page} from '@playwright/test'
import {connectToElectron, disconnect} from '@/tests/e2e/electron/helpers/connect'
import {navigateToSettings} from '@/tests/e2e/electron/helpers/navigate'
import {SETTINGS_ACCOUNT} from '@/tests/e2e/shared/test-ids'

let page: Page

test.beforeAll(async () => {
  ;({page} = await connectToElectron())
})

test.afterAll(async () => {
  await disconnect()
})

test('settings tab renders', async () => {
  await navigateToSettings(page)
  await expect(page.getByTestId(SETTINGS_ACCOUNT)).toBeVisible()
})
