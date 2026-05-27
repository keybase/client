import {test, expect, type Page} from '@playwright/test'
import {connectToElectron, disconnect} from '../helpers/connect'
import {navigateToFiles} from '../helpers/navigate'
import {FILES_BROWSER} from '../../shared/test-ids'

let page: Page

test.beforeAll(async () => {
  ;({page} = await connectToElectron())
})

test.afterAll(async () => {
  await disconnect()
})

test('files browser renders', async () => {
  await navigateToFiles(page)
  await expect(page.getByTestId(FILES_BROWSER)).toBeVisible()
})
