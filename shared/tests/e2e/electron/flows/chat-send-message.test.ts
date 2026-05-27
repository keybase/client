import {test, expect, type Page} from '@playwright/test'
import {connectToElectron, disconnect} from '@/tests/e2e/electron/helpers/connect'
import {navigateToChat} from '@/tests/e2e/electron/helpers/navigate'
import {CHAT_INBOX_ROW, CHAT_MESSAGE_LIST, CHAT_INPUT} from '@/tests/e2e/shared/test-ids'

let page: Page

test.beforeAll(async () => {
  ;({page} = await connectToElectron())
})

test.afterAll(async () => {
  await disconnect()
})

test('send a message to KB_SMOKE_USER', async () => {
  await navigateToChat(page)

  const smokeUser = process.env['KB_SMOKE_USER']!

  // KB_SMOKE_USER's conversation must be the most recent (first row)
  const firstRow = page.getByTestId(CHAT_INBOX_ROW).first()
  await expect(firstRow).toContainText(smokeUser, {timeout: 3_000})
  await firstRow.click()

  // Wait for message list to load
  await page.waitForSelector(`[data-testid="${CHAT_MESSAGE_LIST}"]`, {timeout: 3_000})

  // Type and send a unique message
  const testMessage = `e2e-test-${Date.now()}`
  const input = page.getByTestId(CHAT_INPUT)
  await expect(input).toBeVisible()
  await input.click()
  await input.fill(testMessage)
  await input.press('Enter')

  // Verify message appears in the message list
  await expect(
    page.locator(`[data-testid="${CHAT_MESSAGE_LIST}"]`).getByText(testMessage)
  ).toBeVisible({timeout: 5_000})
})
