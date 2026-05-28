import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {navigateToChat} from '@/tests/e2e/electron/helpers/navigate'
import {CHAT_INBOX_LIST, CHAT_INBOX_ROW} from '@/tests/e2e/shared/test-ids'

test('chat tab renders', async ({page}) => {
  await navigateToChat(page)
  await expect(page.getByTestId(CHAT_INBOX_LIST)).toBeVisible()
})

test('chat inbox row is visible', async ({page}) => {
  await navigateToChat(page)
  await expect(page.getByTestId(CHAT_INBOX_ROW).first()).toBeVisible()
})
