import {test, expect, type Page} from '@playwright/test'
import {connectToElectron, disconnect} from '../helpers/connect'
import {navigateToDevices} from '../helpers/navigate'
import {DEVICES_LIST, DEVICES_ROW} from '../../shared/test-ids'

let page: Page

test.beforeAll(async () => {
  ;({page} = await connectToElectron())
})

test.afterAll(async () => {
  await disconnect()
})

test('devices list renders', async () => {
  await navigateToDevices(page)
  await expect(page.getByTestId(DEVICES_LIST)).toBeVisible()
})

test('devices list has at least one device', async () => {
  await navigateToDevices(page)
  // Logged-in user must have at least the current device
  await expect(page.getByTestId(DEVICES_ROW).first()).toBeVisible()
})
