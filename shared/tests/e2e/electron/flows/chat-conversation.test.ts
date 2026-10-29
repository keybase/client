import type {Page} from '@playwright/test'
import {test, expect, e2eMarker, seedChatData} from '@/tests/e2e/electron/helpers/fixtures'
import {navigateToChat} from '@/tests/e2e/electron/helpers/navigate'
import {clickUnoccluded, inboxRow} from '@/tests/e2e/electron/helpers/chat'
import {sendDirectFromCli, type ChatData} from '@/tests/e2e/shared/chat-data'
import {CHAT_INBOX_LIST, CHAT_MESSAGE_LIST, CHAT_INPUT, NAV_TAB_CHAT} from '@/tests/e2e/shared/test-ids'

// Opens a conversation from its inbox row: the smoke account's one-on-one with the second account,
// moved to the top of the inbox by a message the CLI (the smoke account) sends first. Never the
// inbox's top row as found: the smoke account is in conversations that are not the tests' to act on.

let data: ChatData

test.beforeAll(async () => {
  test.setTimeout(20 * 60_000) // a first run seeds; later runs only check
  data = await seedChatData()
})

const openDirectFromInbox = async (page: Page) => {
  await sendDirectFromCli(data.direct.tlfName, e2eMarker('inbox'))
  await navigateToChat(page)
  const row = inboxRow(page, data.secondUser)
  await expect(row, 'the conversation with the second account in the inbox').toBeVisible({timeout: 10_000})
  await clickUnoccluded(row)
  await expect(page.getByTestId(CHAT_MESSAGE_LIST).first()).toBeVisible({timeout: 5_000})
}

test('can open a conversation from the inbox', async ({page}) => {
  await openDirectFromInbox(page)
})

test('chat input is visible in open conversation', async ({page}) => {
  await openDirectFromInbox(page)
  await expect(page.getByTestId(CHAT_INPUT).first()).toBeVisible()
})

test('can return to inbox from conversation', async ({page}) => {
  await openDirectFromInbox(page)
  await page.getByTestId(NAV_TAB_CHAT).click()
  await expect(page.getByTestId(CHAT_INBOX_LIST).first()).toBeVisible({timeout: 5_000})
})
