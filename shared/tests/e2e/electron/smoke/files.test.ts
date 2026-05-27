import {test, expect, type Page} from '@playwright/test'
import {connectToElectron, disconnect} from '@/tests/e2e/electron/helpers/connect'
import {navigateToFiles} from '@/tests/e2e/electron/helpers/navigate'
import {FILES_BROWSER} from '@/tests/e2e/shared/test-ids'

let page: Page

test.beforeAll(async () => {
  ;({page} = await connectToElectron())
})

test.afterAll(async () => {
  await disconnect()
})

test('files tab renders', async () => {
  await navigateToFiles(page)
  await expect(page.getByTestId(FILES_BROWSER)).toBeVisible()
})
