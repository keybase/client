import {test, expect, type Browser, type Page} from '@playwright/test'
import {connectToElectron, disconnect} from '../helpers/connect'
import {navigateToPeople} from '../helpers/navigate'
import {PEOPLE_FEED} from '../../shared/test-ids'

let browser: Browser
let page: Page

test.beforeAll(async () => {
  ;({browser, page} = await connectToElectron())
})

test.afterAll(async () => {
  await disconnect()
})

test('people tab renders', async () => {
  await navigateToPeople(page)
  await expect(page.getByTestId(PEOPLE_FEED)).toBeVisible()
})
