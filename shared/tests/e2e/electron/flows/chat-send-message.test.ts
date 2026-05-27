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

test('send a message in first conversation', async () => {
  await navigateToChat(page)

  // Open first conversation
  await page.getByTestId(CHAT_INBOX_ROW).first().click()
  await page.waitForSelector(`[data-testid="${CHAT_MESSAGE_LIST}"]`, {timeout: 3_000})

  // Type a unique message
  const testMessage = `e2e-test-${Date.now()}`
  const input = page.getByTestId(CHAT_INPUT)
  await expect(input).toBeVisible()
  await input.click()
  await input.fill(testMessage)

  // Send with Enter
  await input.press('Enter')

  // Verify message appears in the message list
  await expect(
    page.locator(`[data-testid="${CHAT_MESSAGE_LIST}"]`).getByText(testMessage)
  ).toBeVisible({timeout: 3_000})
})
