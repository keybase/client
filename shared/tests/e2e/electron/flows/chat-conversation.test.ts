import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {navigateToChat} from '@/tests/e2e/electron/helpers/navigate'
import {CHAT_INBOX_LIST, CHAT_INBOX_ROW, CHAT_MESSAGE_LIST, CHAT_INPUT} from '@/tests/e2e/shared/test-ids'

test('can open first conversation', async ({page}) => {
  await navigateToChat(page)
  const rows = page.getByTestId(CHAT_INBOX_ROW)
  const count = await rows.count()
  if (count === 0) {
    test.skip()
    return
  }
  await rows.first().click()
  await expect(page.getByTestId(CHAT_MESSAGE_LIST).first()).toBeVisible({timeout: 5_000})
})

test('chat input is visible in open conversation', async ({page}) => {
  await navigateToChat(page)
  const rows = page.getByTestId(CHAT_INBOX_ROW)
  const count = await rows.count()
  if (count === 0) {
    test.skip()
    return
  }
  await rows.first().click()
  await expect(page.getByTestId(CHAT_MESSAGE_LIST).first()).toBeVisible({timeout: 5_000})
  await expect(page.getByTestId(CHAT_INPUT).first()).toBeVisible()
})

test('can return to inbox from conversation', async ({page}) => {
  await navigateToChat(page)
  const rows = page.getByTestId(CHAT_INBOX_ROW)
  const count = await rows.count()
  if (count === 0) {
    test.skip()
    return
  }
  await rows.first().click()
  await expect(page.getByTestId(CHAT_MESSAGE_LIST).first()).toBeVisible({timeout: 5_000})
  await page.click('text=Chat')
  await expect(page.getByTestId(CHAT_INBOX_LIST).first()).toBeVisible({timeout: 5_000})
})
