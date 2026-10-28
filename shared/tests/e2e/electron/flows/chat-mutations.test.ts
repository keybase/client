import type {Page} from '@playwright/test'
import {test, expect, seedChatData} from '@/tests/e2e/electron/helpers/fixtures'
import {navigateToChat} from '@/tests/e2e/electron/helpers/navigate'
import {openDirectConversation, openE2EChannel} from '@/tests/e2e/electron/helpers/chat'
import {type ChatData} from '@/tests/e2e/shared/chat-data'
import {manualEdge, step} from '@/tests/e2e/electron/helpers/step'
import * as T from '@/tests/e2e/shared/test-ids'
import {closeModal} from '@/tests/e2e/electron/helpers/modal'

// View-only trips into mutation flows: open the modal, screenshot, cancel.
// Nothing here ever submits. They open e2e-scratch and the smoke account's conversation with the
// second account, never another conversation.

let data: ChatData

test.beforeAll(async () => {
  test.setTimeout(20 * 60_000) // a first run seeds; later runs only check
  data = await seedChatData()
})

async function openInfoPanelSettings(page: Page): Promise<void> {
  await page.locator('.icon-gen-iconfont-info:visible').first().click()
  await expect(page.getByTestId(T.CHAT_INFO_PANEL)).toBeVisible({timeout: 5_000})
  await page.getByTestId(T.CHAT_INFO_PANEL).getByText('Settings', {exact: true}).click()
}

async function closeInfoPanel(page: Page): Promise<void> {
  await page.locator('.icon-gen-iconfont-info:visible').first().click()
  await expect(page.getByTestId(T.CHAT_INFO_PANEL)).not.toBeVisible({timeout: 5_000})
}

test('new chat team builder opens', async ({page}, testInfo) => {
  await navigateToChat(page)
  await page.getByText('New chat', {exact: true}).click()
  const search = page.getByPlaceholder('Search Keybase').locator('visible=true')
  await expect(search.first()).toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'new chat team builder')
  await closeModal(page)
  await expect(search).toHaveCount(0, {timeout: 5_000})
})

test('delete history warning opens', async ({page}, testInfo) => {
  await openE2EChannel(page)
  await openInfoPanelSettings(page)
  await page.getByText('Clear entire conversation', {exact: true}).click()
  const confirmButton = page.getByText('Yes, clear for everyone', {exact: true})
  await expect(confirmButton).toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'delete history warning')
  await page.getByText('Cancel', {exact: true}).locator('visible=true').first().click()
  await expect(confirmButton).not.toBeVisible({timeout: 5_000})
  await closeInfoPanel(page)
})

test('block modal opens', async ({page}, testInfo) => {
  // team conversations have no Block button: the one-on-one with the second account has
  await openDirectConversation(page, data.secondUser)
  await openInfoPanelSettings(page)
  const blockButton = page.getByTestId(T.CHAT_INFO_PANEL).getByText('Block', {exact: true})
  await expect(blockButton.first(), 'Block in the one-on-one conversation settings').toBeVisible({timeout: 5_000})
  await blockButton.first().click()
  const finishButton = page.getByText('Finish', {exact: true})
  await expect(finishButton).toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'block modal')
  await manualEdge(page, testInfo, 'block-report-submit')
  await page.getByText('Cancel', {exact: true}).locator('visible=true').first().click()
  await expect(finishButton).not.toBeVisible({timeout: 5_000})
  await closeInfoPanel(page)
})
