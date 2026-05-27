import {test, expect, type Page} from '@playwright/test'
import {connectToElectron, disconnect} from '../helpers/connect'
import {navigateToPeople} from '../helpers/navigate'
import {PEOPLE_FEED} from '../../shared/test-ids'

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
