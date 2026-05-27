import {test, expect, type Page} from '@playwright/test'
import {connectToElectron, disconnect} from '@/tests/e2e/electron/helpers/connect'
import {navigateToDevices} from '@/tests/e2e/electron/helpers/navigate'
import {DEVICES_LIST} from '@/tests/e2e/shared/test-ids'

let page: Page

test.beforeAll(async () => {
  ;({page} = await connectToElectron())
})

test.afterAll(async () => {
  await disconnect()
})

test('devices tab renders', async () => {
  await navigateToDevices(page)
  await expect(page.getByTestId(DEVICES_LIST).first()).toBeVisible()
})
