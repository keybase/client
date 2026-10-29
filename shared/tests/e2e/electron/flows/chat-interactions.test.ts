import type {ConsoleMessage, Page} from '@playwright/test'
import {test, expect, e2eMarker, seedChatData} from '@/tests/e2e/electron/helpers/fixtures'
import {composerInput, mediaInViewLoaded, messageMenu, openE2EChannel, rowByOrdinal, waitForRow, waitForScrollStable} from '@/tests/e2e/electron/helpers/chat'
import {E2E_CHANNELS, sendFromCli} from '@/tests/e2e/shared/chat-data'
import {step} from '@/tests/e2e/electron/helpers/step'
import * as T from '@/tests/e2e/shared/test-ids'

// More chat visual states, in e2e-scratch: reply/edit input modes, reaction picker, channel
// mentions, giphy, info panel sub-tabs. Nothing is ever sent from the app or saved; the tests that
// need a message of the smoke account's own send one through the CLI first.

test.beforeAll(async () => {
  test.setTimeout(20 * 60_000) // a first run seeds; later runs only check
  await seedChatData()
})

// Opens e2e-scratch, sends a text message from the CLI (the smoke account) and returns its ordinal.
const openWithOwnMessage = async (page: Page, label: string) => {
  await openE2EChannel(page)
  const marker = e2eMarker(label)
  await sendFromCli(E2E_CHANNELS.scratch, marker)
  return waitForRow(page, marker, 30_000)
}

// Empties the composer: ArrowUp edits the last message only from an empty input.
const clearComposer = async (page: Page) => {
  await composerInput(page).click({timeout: 5_000})
  await page.keyboard.press('Meta+a')
  await page.keyboard.press('Backspace')
}

test('reply-quote state in input', async ({page}, testInfo) => {
  const ordinal = await openWithOwnMessage(page, 'reply')
  const menu = await messageMenu(page, ordinal)
  await menu.getByText('Reply', {exact: true}).click()
  const replyingTo = page.getByText('Replying to:')
  await expect(replyingTo).toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'reply quote in input')
  await page.locator('.icon-gen-iconfont-remove:visible').first().click()
  await expect(replyingTo).not.toBeVisible({timeout: 5_000})
})

test('edit-message mode in input', async ({page}, testInfo) => {
  // ArrowUp in an empty input edits your own last message. Desktop edit mode shows a "Cancel"
  // button next to the input (Save/Send is mobile-only).
  await openWithOwnMessage(page, 'edit')
  const cancelButton = page.getByText('Cancel', {exact: true}).locator('visible=true').first()
  await clearComposer(page)
  await page.keyboard.press('ArrowUp')
  await expect(cancelButton, 'ArrowUp in an empty composer to edit the message just sent').toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'edit mode in input')
  await page.keyboard.press('Escape')
  await expect(cancelButton).not.toBeVisible({timeout: 5_000})
  await clearComposer(page)
})

test('reaction picker opens from hover toolbar', async ({page}, testInfo) => {
  const ordinal = await openWithOwnMessage(page, 'react')
  const row = rowByOrdinal(page, ordinal)
  const reacji = row.locator('.icon-gen-iconfont-reacji')
  // The row shows its toolbar only while hovered (CSS :hover), and any scroll of the list turns the
  // pointer off over it for 200ms (scroll-ignore-pointer), which hides the toolbar until the pointer
  // moves again. A hover that has to scroll the row into view does exactly that, so the row is
  // brought into view first and the press waits until the list has stopped and takes the pointer.
  await row.scrollIntoViewIfNeeded()
  await waitForScrollStable(page)
  await expect(page.locator('.scroll-ignore-pointer'), 'the thread taking the pointer again').toHaveCount(0)
  await row.hover()
  await expect(reacji.first(), 'the hover toolbar reaction button on the message just sent').toBeVisible({
    timeout: 5_000,
  })
  await reacji.first().click()
  await expect(page.getByTestId(T.CHAT_EMOJI_PICKER)).toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'reaction picker')
  await page.getByTestId(T.CHAT_MESSAGE_LIST).first().click({force: true, position: {x: 10, y: 10}})
  await expect(page.getByTestId(T.CHAT_EMOJI_PICKER)).not.toBeVisible({timeout: 5_000})
})

test('channel mention popup in team conversation', async ({page}, testInfo) => {
  const suggestions = page.getByTestId(T.CHAT_SUGGESTION_LIST)
  await openE2EChannel(page)
  await clearComposer(page)
  await page.keyboard.type('#')
  await expect(suggestions.first(), 'the channel suggestions for "#" in a team channel').toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'channel mention popup')
  await page.keyboard.press('Meta+a')
  await page.keyboard.press('Backspace')
  await page.keyboard.press('Escape')
  await expect(suggestions).toHaveCount(0, {timeout: 5_000})
})

test('giphy preview renders', async ({page}, testInfo) => {
  await openE2EChannel(page)
  await page.getByTestId(T.CHAT_INPUT).first().click()
  // clear any draft left by another test before typing the command
  await page.keyboard.press('Meta+a')
  await page.keyboard.press('Backspace')
  await page.keyboard.type('/giphy hello', {delay: 30})
  const tip = page.getByText("Tip: hit 'Enter' now to send a random GIF.")
  await expect(tip).toBeVisible({timeout: 10_000})
  // give preview images a moment to load
  await page.waitForTimeout(1_500)
  await step(page, testInfo, 'giphy preview')
  await page.keyboard.press('Meta+a')
  await page.keyboard.press('Backspace')
  await expect(tip).not.toBeVisible({timeout: 5_000})
})

test('info panel attachments tab', async ({page}, testInfo) => {
  await openE2EChannel(page)
  await page.locator('.icon-gen-iconfont-info:visible').first().click()
  await expect(page.getByTestId(T.CHAT_INFO_PANEL)).toBeVisible({timeout: 5_000})
  // the app logs each gallery page it loads; the media view loads one when the tab opens
  let loaded = false
  const onConsole = (m: ConsoleMessage) => {
    if (m.text().includes('attachment gallery load success')) loaded = true
  }
  page.on('console', onConsole)
  try {
    await page.getByTestId(T.CHAT_INFO_PANEL).getByText('Attachments', {exact: true}).click()
    // the attachments tab shows media type sub-tabs
    await expect(page.getByTestId(T.CHAT_INFO_PANEL).getByText('Docs', {exact: true})).toBeVisible({
      timeout: 5_000,
    })
    await expect.poll(() => loaded, {message: 'the media gallery loaded', timeout: 20_000}).toBe(true)
  } finally {
    page.off('console', onConsole)
  }
  await expect
    .poll(async () => mediaInViewLoaded(page.getByTestId(T.CHAT_INFO_PANEL)), {message: 'the media thumbnails in view drawn', timeout: 20_000})
    .toBe(true)
  await step(page, testInfo, 'info panel attachments tab')
  await page.locator('.icon-gen-iconfont-info:visible').first().click()
  await expect(page.getByTestId(T.CHAT_INFO_PANEL)).not.toBeVisible({timeout: 5_000})
})

test('info panel settings tab', async ({page}, testInfo) => {
  await openE2EChannel(page)
  await page.locator('.icon-gen-iconfont-info:visible').first().click()
  await expect(page.getByTestId(T.CHAT_INFO_PANEL)).toBeVisible({timeout: 5_000})
  await page.getByTestId(T.CHAT_INFO_PANEL).getByText('Settings', {exact: true}).click()
  await expect(page.getByText('Mute all notifications').first()).toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'info panel settings tab')
  await page.locator('.icon-gen-iconfont-info:visible').first().click()
  await expect(page.getByTestId(T.CHAT_INFO_PANEL)).not.toBeVisible({timeout: 5_000})
})
