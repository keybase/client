import {test, expect, type Browser, type Page} from '@playwright/test'
import {connectToElectron, disconnect} from '../helpers/connect'
import {navigateToDevices} from '../helpers/navigate'
import {DEVICES_LIST} from '../../shared/test-ids'

let browser: Browser
let page: Page

test.beforeAll(async () => {
  ;({browser, page} = await connectToElectron())
})

test.afterAll(async () => {
  await disconnect()
})

test('devices tab renders', async () => {
  await navigateToDevices(page)
  await expect(page.getByTestId(DEVICES_LIST)).toBeVisible()
})
