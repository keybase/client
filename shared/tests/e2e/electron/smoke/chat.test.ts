import {test, expect, type Page} from '@playwright/test'
import {connectToElectron, disconnect} from '@/tests/e2e/electron/helpers/connect'
import {navigateToChat} from '@/tests/e2e/electron/helpers/navigate'
import {CHAT_INBOX_LIST, CHAT_INBOX_ROW} from '@/tests/e2e/shared/test-ids'

let page: Page

test.beforeAll(async () => {
  ;({page} = await connectToElectron())
})

test.afterAll(async () => {
  await disconnect()
})

test('chat tab renders', async () => {
  await navigateToChat(page)
  await expect(page.getByTestId(CHAT_INBOX_LIST)).toBeVisible()
})

test('chat inbox row is visible', async () => {
  await navigateToChat(page)
  await expect(page.getByTestId(CHAT_INBOX_ROW).first()).toBeVisible()
})
