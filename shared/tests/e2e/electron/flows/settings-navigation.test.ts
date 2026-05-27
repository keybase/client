import {test, expect, type Page} from '@playwright/test'
import {connectToElectron, disconnect} from '../helpers/connect'
import {navigateToSettings} from '../helpers/navigate'
import {SETTINGS_ACCOUNT} from '../../shared/test-ids'

let page: Page

test.beforeAll(async () => {
  ;({page} = await connectToElectron())
})

test.afterAll(async () => {
  await disconnect()
})

test('settings nav renders', async () => {
  await navigateToSettings(page)
  await expect(page.getByTestId(SETTINGS_ACCOUNT)).toBeVisible()
})

test('can click Account settings', async () => {
  await navigateToSettings(page)
  await page.click('text=Your account')
  // The account settings pane should be visible after clicking
  await expect(page.getByTestId(SETTINGS_ACCOUNT)).toBeVisible()
})
