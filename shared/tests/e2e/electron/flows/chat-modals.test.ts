import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {openFirstConversation, openConversationMatching} from '@/tests/e2e/electron/helpers/navigate'
import {snap} from '@/tests/e2e/electron/helpers/snap'
import * as T from '@/tests/e2e/shared/test-ids'

// Kb.Icon has no testID prop on desktop; it renders a span with an
// icon-gen-<type> class, so icons are selected by class here.

test('info panel opens', async ({page}, testInfo) => {
  if (!(await openFirstConversation(page))) {
    test.skip()
    return
  }
  await page.locator('.icon-gen-iconfont-info:visible').first().click()
  await expect(page.getByTestId(T.CHAT_INFO_PANEL)).toBeVisible({timeout: 5_000})
  await snap(page, testInfo)
  // toggle it back off so later tests see a clean conversation
  await page.locator('.icon-gen-iconfont-info:visible').first().click()
  await expect(page.getByTestId(T.CHAT_INFO_PANEL)).not.toBeVisible({timeout: 5_000})
})

test('emoji picker opens', async ({page}, testInfo) => {
  if (!(await openFirstConversation(page))) {
    test.skip()
    return
  }
  await page.locator('.icon-gen-iconfont-emoji:visible').last().click()
  await expect(page.getByTestId(T.CHAT_EMOJI_PICKER)).toBeVisible({timeout: 5_000})
  await snap(page, testInfo)
  // the popup dismisses on outside click, not Escape
  await page.getByTestId(T.CHAT_MESSAGE_LIST).first().click({force: true, position: {x: 10, y: 10}})
  await expect(page.getByTestId(T.CHAT_EMOJI_PICKER)).not.toBeVisible({timeout: 5_000})
})

test('message context menu opens', async ({page}, testInfo) => {
  const menuItem = page.getByText('Reply', {exact: true}).locator('visible=true').first()
  // system messages don't open a popup — walk back until one does
  const opensMenu = async (p: typeof page) => {
    const messages = p.locator('.TextAndSiblings')
    const count = await messages.count()
    for (let i = count - 1; i >= 0 && i >= count - 5; i--) {
      await messages.nth(i).click({button: 'right'})
      if (await menuItem.waitFor({state: 'visible', timeout: 2_000}).then(() => true).catch(() => false)) {
        return true
      }
    }
    return false
  }
  if (!(await openConversationMatching(page, opensMenu, 3))) {
    test.skip()
    return
  }
  await snap(page, testInfo)
  await page.keyboard.press('Escape')
  await expect(menuItem).not.toBeVisible({timeout: 5_000})
})

test('attachment fullscreen opens', async ({page}, testInfo) => {
  const images = page.getByTestId(T.CHAT_ATTACHMENT_IMAGE)
  const found = await openConversationMatching(page, async () => (await images.count()) > 0)
  if (!found) {
    test.skip()
    return
  }
  await images.last().click()
  await expect(page.getByTestId(T.CHAT_ATTACHMENT_FULLSCREEN)).toBeVisible({timeout: 5_000})
  await snap(page, testInfo)
  await page.locator('.icon-gen-iconfont-close:visible').first().click()
  await expect(page.getByTestId(T.CHAT_ATTACHMENT_FULLSCREEN)).not.toBeVisible({timeout: 5_000})
})

test('bot install preview opens', async ({page}, testInfo) => {
  if (!(await openFirstConversation(page))) {
    test.skip()
    return
  }
  await page.locator('.icon-gen-iconfont-info:visible').first().click()
  await expect(page.getByTestId(T.CHAT_INFO_PANEL)).toBeVisible({timeout: 5_000})
  await page.getByTestId(T.CHAT_INFO_PANEL).getByText('Bots', {exact: true}).click()
  const botRows = page.getByTestId(T.CHAT_BOT_ROW)
  await expect(botRows.first()).toBeVisible({timeout: 10_000})
  // the row center sits on the "by <owner>" username link, which navigates to
  // that user's profile instead — click the avatar column on the left
  await botRows.first().click({position: {x: 20, y: 28}})
  // the footer button depends on the bot's state (Install / Review / Edit
  // settings / Uninstall), so assert on the modal instead of a label
  const installModal = page.getByTestId(T.CHAT_BOT_INSTALL).first()
  await expect(installModal).toBeVisible({timeout: 10_000})
  await snap(page, testInfo)
  await page.locator('.icon-gen-iconfont-close:visible').first().click()
  await expect(installModal).not.toBeVisible({timeout: 5_000})
  // close the info panel again
  await page.locator('.icon-gen-iconfont-info:visible').first().click()
  await expect(page.getByTestId(T.CHAT_INFO_PANEL)).not.toBeVisible({timeout: 5_000})
})

test('bot search modal opens', async ({page}, testInfo) => {
  if (!(await openFirstConversation(page))) {
    test.skip()
    return
  }
  await page.locator('.icon-gen-iconfont-info:visible').first().click()
  await expect(page.getByTestId(T.CHAT_INFO_PANEL)).toBeVisible({timeout: 5_000})
  await page.getByTestId(T.CHAT_INFO_PANEL).getByText('Bots', {exact: true}).click()
  await page.getByText('Add a bot', {exact: true}).click()
  const search = page.getByPlaceholder('Search featured bots or users...')
  await expect(search).toBeVisible({timeout: 10_000})
  await snap(page, testInfo)
  await page.locator('.icon-gen-iconfont-close:visible').first().click()
  await expect(search).not.toBeVisible({timeout: 5_000})
  await page.locator('.icon-gen-iconfont-info:visible').first().click()
  await expect(page.getByTestId(T.CHAT_INFO_PANEL)).not.toBeVisible({timeout: 5_000})
})

test('forward message picker opens', async ({page}, testInfo) => {
  const forwardItem = page.getByText('Forward', {exact: true}).first()
  // not every message type offers Forward — walk back until one does
  const findForwardableMessage = async (p: typeof page) => {
    const messages = p.locator('.TextAndSiblings')
    const count = await messages.count()
    for (let i = count - 1; i >= 0 && i >= count - 5; i--) {
      await messages.nth(i).click({button: 'right'})
      // system messages may not open a menu at all — just move on
      const menuOpened = await p
        .getByText('Reply', {exact: true})
        .locator('visible=true')
        .first()
        .waitFor({state: 'visible', timeout: 2_000})
        .then(() => true)
        .catch(() => false)
      if (menuOpened && (await forwardItem.isVisible())) return true
      if (menuOpened) await p.keyboard.press('Escape')
    }
    return false
  }
  const found = await openConversationMatching(page, findForwardableMessage, 5)
  if (!found) {
    test.skip()
    return
  }
  await forwardItem.click()
  const search = page.getByPlaceholder('Search chats and teams...')
  await expect(search).toBeVisible({timeout: 5_000})
  await snap(page, testInfo)
  await page.keyboard.press('Escape')
  await expect(search).not.toBeVisible({timeout: 5_000})
})
