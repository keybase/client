import {test, expect, type Page} from '@playwright/test'
import {connectToElectron, disconnect} from '../helpers/connect'
import {navigateToDevices} from '../helpers/navigate'
import {DEVICES_LIST} from '../../shared/test-ids'

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
