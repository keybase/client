import type {Page} from '@playwright/test'
import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {
  navigateToChat,
  openConversationMatching,
  openFirstConversation,
} from '@/tests/e2e/electron/helpers/navigate'
import {snap} from '@/tests/e2e/electron/helpers/snap'
import * as T from '@/tests/e2e/shared/test-ids'

// View-only trips into mutation flows: open the modal, screenshot, cancel.
// Nothing here ever submits.

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
  await snap(page, testInfo)
  await page.locator('.icon-gen-iconfont-close:visible').first().click()
  await expect(search).toHaveCount(0, {timeout: 5_000})
})

test('delete history warning opens', async ({page}, testInfo) => {
  if (!(await openFirstConversation(page))) {
    test.skip()
    return
  }
  await openInfoPanelSettings(page)
  await page.getByText('Clear entire conversation', {exact: true}).click()
  const confirmButton = page.getByText('Yes, clear for everyone', {exact: true})
  await expect(confirmButton).toBeVisible({timeout: 5_000})
  await snap(page, testInfo)
  await page.getByText('Cancel', {exact: true}).locator('visible=true').first().click()
  await expect(confirmButton).not.toBeVisible({timeout: 5_000})
  await closeInfoPanel(page)
})

test('block modal opens', async ({page}, testInfo) => {
  const blockButton = page.getByTestId(T.CHAT_INFO_PANEL).getByText('Block', {exact: true})
  // team conversations have no Block button — hunt for a 1:1 conversation
  const hasBlock = async (p: typeof page) => {
    await openInfoPanelSettings(p)
    if ((await blockButton.count()) > 0) return true
    await closeInfoPanel(p)
    return false
  }
  const found = await openConversationMatching(page, hasBlock, 4)
  if (!found) {
    test.skip()
    return
  }
  await blockButton.first().click()
  const finishButton = page.getByText('Finish', {exact: true})
  await expect(finishButton).toBeVisible({timeout: 5_000})
  await snap(page, testInfo)
  await page.getByText('Cancel', {exact: true}).locator('visible=true').first().click()
  await expect(finishButton).not.toBeVisible({timeout: 5_000})
  await closeInfoPanel(page)
})
