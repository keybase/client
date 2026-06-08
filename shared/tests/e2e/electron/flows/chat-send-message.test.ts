import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {navigateToChat} from '@/tests/e2e/electron/helpers/navigate'
import {CHAT_INBOX_ROW, CHAT_MESSAGE_LIST, CHAT_INPUT} from '@/tests/e2e/shared/test-ids'

test('send a message to KB_SMOKE_USER', async ({page}, testInfo) => {
  testInfo.annotations.push({type: 'account', description: process.env['KB_SMOKE_USER']!})

  const smokeUser = process.env['KB_SMOKE_USER']!

  await test.step('navigate to chat', async () => {
    await navigateToChat(page)
  })

  await test.step('open conversation with KB_SMOKE_USER (must be most recent)', async () => {
    const firstRow = page.getByTestId(CHAT_INBOX_ROW).first()
    await expect(firstRow).toContainText(smokeUser, {timeout: 3_000})
    await firstRow.click()
    await page.waitForSelector(`[data-testid="${CHAT_MESSAGE_LIST}"]`, {timeout: 3_000})
  })

  const testMessage = `e2e-test-${Date.now()}`

  await test.step(`type and send "${testMessage}"`, async () => {
    const input = page.getByTestId(CHAT_INPUT)
    await expect(input).toBeVisible()
    await input.click()
    await input.fill(testMessage)
    await input.press('Enter')
  })

  await test.step('verify message appears in list', async () => {
    await expect(
      page.locator(`[data-testid="${CHAT_MESSAGE_LIST}"]`).getByText(testMessage)
    ).toBeVisible({timeout: 5_000})
  })
})
