import type {Page} from '@playwright/test'
import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {openConversationMatching, openFirstConversation} from '@/tests/e2e/electron/helpers/navigate'
import {snap} from '@/tests/e2e/electron/helpers/snap'
import * as T from '@/tests/e2e/shared/test-ids'

// More chat visual states: reply/edit input modes, reaction picker, channel
// mentions, giphy, info panel sub-tabs. Nothing is ever sent or saved.

test('reply-quote state in input', async ({page}, testInfo) => {
  const replyItem = page.getByText('Reply', {exact: true}).first()
  const findReplyableMessage = async (p: Page) => {
    const messages = p.locator('.TextAndSiblings')
    const count = await messages.count()
    for (let i = count - 1; i >= 0 && i >= count - 5; i--) {
      await messages.nth(i).click({button: 'right'})
      try {
        await expect(replyItem).toBeVisible({timeout: 2_000})
        return true
      } catch {
        await p.keyboard.press('Escape')
      }
    }
    return false
  }
  if (!(await openConversationMatching(page, findReplyableMessage, 3))) {
    test.skip()
    return
  }
  await replyItem.click()
  const replyingTo = page.getByText('Replying to:')
  await expect(replyingTo).toBeVisible({timeout: 5_000})
  await snap(page, testInfo)
  await page.locator('.icon-gen-iconfont-remove:visible').first().click()
  await expect(replyingTo).not.toBeVisible({timeout: 5_000})
})

test('edit-message mode in input', async ({page}, testInfo) => {
  test.setTimeout(60_000) // probes several conversations at ~4s each
  // ArrowUp in an empty input edits your own last message — only works in a
  // conversation where you have sent something. Desktop edit mode shows a
  // "Cancel" button next to the input (Save/Send is mobile-only).
  const saveButton = page.getByText('Cancel', {exact: true}).locator('visible=true').first()
  const entersEditMode = async (p: Page) => {
    await p.getByTestId(T.CHAT_INPUT).first().click()
    // ArrowUp only triggers edit mode when the input is empty — clear drafts first
    await p.keyboard.press('Meta+a')
    await p.keyboard.press('Backspace')
    await p.keyboard.press('ArrowUp')
    try {
      await expect(saveButton).toBeVisible({timeout: 4_000})
      return true
    } catch {
      // leave no draft behind: exit edit mode and clear whatever got filled in
      await p.keyboard.press('Escape')
      await p.keyboard.press('Meta+a')
      await p.keyboard.press('Backspace')
      return false
    }
  }
  if (!(await openConversationMatching(page, entersEditMode, 5))) {
    test.skip()
    return
  }
  await snap(page, testInfo)
  await page.keyboard.press('Escape')
  await expect(saveButton).not.toBeVisible({timeout: 5_000})
})

test('reaction picker opens from hover toolbar', async ({page}, testInfo) => {
  const reacji = page.locator('.icon-gen-iconfont-reacji:visible')
  // system messages have no hover toolbar — hunt for one that does
  const hasReacjiOnHover = async (p: Page) => {
    const messages = p.locator('.TextAndSiblings')
    const count = await messages.count()
    for (let i = count - 1; i >= 0 && i >= count - 5; i--) {
      await messages.nth(i).hover()
      await p.waitForTimeout(300)
      if ((await reacji.count()) > 0) return true
    }
    return false
  }
  if (!(await openConversationMatching(page, hasReacjiOnHover, 3))) {
    test.skip()
    return
  }
  await reacji.first().click()
  await expect(page.getByTestId(T.CHAT_EMOJI_PICKER)).toBeVisible({timeout: 5_000})
  await snap(page, testInfo)
  await page.getByTestId(T.CHAT_MESSAGE_LIST).first().click({force: true, position: {x: 10, y: 10}})
  await expect(page.getByTestId(T.CHAT_EMOJI_PICKER)).not.toBeVisible({timeout: 5_000})
})

test('channel mention popup in team conversation', async ({page}, testInfo) => {
  const suggestions = page.getByTestId(T.CHAT_SUGGESTION_LIST)
  const showsChannelSuggestions = async (p: Page) => {
    await p.getByTestId(T.CHAT_INPUT).first().click()
    await p.keyboard.press('Meta+a')
    await p.keyboard.press('Backspace')
    await p.keyboard.type('#')
    try {
      await expect(suggestions.first()).toBeVisible({timeout: 2_000})
      return true
    } catch {
      await p.keyboard.press('Backspace')
      return false
    }
  }
  if (!(await openConversationMatching(page, showsChannelSuggestions, 5))) {
    test.skip()
    return
  }
  await snap(page, testInfo)
  await page.keyboard.press('Meta+a')
  await page.keyboard.press('Backspace')
  await page.keyboard.press('Escape')
  await expect(suggestions).toHaveCount(0, {timeout: 5_000})
})

test('giphy preview renders', async ({page}, testInfo) => {
  if (!(await openFirstConversation(page))) {
    test.skip()
    return
  }
  await page.getByTestId(T.CHAT_INPUT).first().click()
  // clear any draft left by another test before typing the command
  await page.keyboard.press('Meta+a')
  await page.keyboard.press('Backspace')
  await page.keyboard.type('/giphy hello', {delay: 30})
  const tip = page.getByText("Tip: hit 'Enter' now to send a random GIF.")
  await expect(tip).toBeVisible({timeout: 10_000})
  // give preview images a moment to load
  await page.waitForTimeout(1_500)
  await snap(page, testInfo)
  await page.keyboard.press('Meta+a')
  await page.keyboard.press('Backspace')
  await expect(tip).not.toBeVisible({timeout: 5_000})
})

test('info panel attachments tab', async ({page}, testInfo) => {
  if (!(await openFirstConversation(page))) {
    test.skip()
    return
  }
  await page.locator('.icon-gen-iconfont-info:visible').first().click()
  await expect(page.getByTestId(T.CHAT_INFO_PANEL)).toBeVisible({timeout: 5_000})
  await page.getByTestId(T.CHAT_INFO_PANEL).getByText('Attachments', {exact: true}).click()
  // the attachments tab shows media type sub-tabs
  await expect(page.getByTestId(T.CHAT_INFO_PANEL).getByText('Docs', {exact: true})).toBeVisible({
    timeout: 5_000,
  })
  await snap(page, testInfo)
  await page.locator('.icon-gen-iconfont-info:visible').first().click()
  await expect(page.getByTestId(T.CHAT_INFO_PANEL)).not.toBeVisible({timeout: 5_000})
})

test('info panel settings tab', async ({page}, testInfo) => {
  if (!(await openFirstConversation(page))) {
    test.skip()
    return
  }
  await page.locator('.icon-gen-iconfont-info:visible').first().click()
  await expect(page.getByTestId(T.CHAT_INFO_PANEL)).toBeVisible({timeout: 5_000})
  await page.getByTestId(T.CHAT_INFO_PANEL).getByText('Settings', {exact: true}).click()
  await expect(page.getByText('Mute all notifications').first()).toBeVisible({timeout: 5_000})
  await snap(page, testInfo)
  await page.locator('.icon-gen-iconfont-info:visible').first().click()
  await expect(page.getByTestId(T.CHAT_INFO_PANEL)).not.toBeVisible({timeout: 5_000})
})
