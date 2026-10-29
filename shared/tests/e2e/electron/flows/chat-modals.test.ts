import {test, expect, e2eRunId, seedChatData} from '@/tests/e2e/electron/helpers/fixtures'
import {closeMenu, messageMenu, openE2EChannel, waitForRow} from '@/tests/e2e/electron/helpers/chat'
import {E2E_CHANNELS, attachFromCli, sendFromCli} from '@/tests/e2e/shared/chat-data'
import {step} from '@/tests/e2e/electron/helpers/step'
import * as T from '@/tests/e2e/shared/test-ids'
import {closeModal} from '@/tests/e2e/electron/helpers/modal'

// Kb.Icon has no testID prop on desktop; it renders a span with an
// icon-gen-<type> class, so icons are selected by class here. Every test acts in the seeded e2e
// channels.

test.beforeAll(async () => {
  test.setTimeout(20 * 60_000) // a first run seeds; later runs only check
  await seedChatData()
})

test('info panel opens', async ({page}, testInfo) => {
  await openE2EChannel(page)
  await page.locator('.icon-gen-iconfont-info:visible').first().click()
  await expect(page.getByTestId(T.CHAT_INFO_PANEL)).toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'info panel')
  // toggle it back off so later tests see a clean conversation
  await page.locator('.icon-gen-iconfont-info:visible').first().click()
  await expect(page.getByTestId(T.CHAT_INFO_PANEL)).not.toBeVisible({timeout: 5_000})
})

test('emoji picker opens', async ({page}, testInfo) => {
  await openE2EChannel(page)
  await page.locator('.icon-gen-iconfont-emoji:visible').last().click()
  await expect(page.getByTestId(T.CHAT_EMOJI_PICKER)).toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'emoji picker')
  // the popup dismisses on outside click, not Escape
  await page.getByTestId(T.CHAT_MESSAGE_LIST).first().click({force: true, position: {x: 10, y: 10}})
  await expect(page.getByTestId(T.CHAT_EMOJI_PICKER)).not.toBeVisible({timeout: 5_000})
})

test('message context menu opens', async ({page}, testInfo) => {
  await openE2EChannel(page)
  const marker = `e2e-${e2eRunId()}-menu-${Date.now().toString(36)}`
  await sendFromCli(E2E_CHANNELS.scratch, marker)
  const ordinal = await waitForRow(page, marker, 30_000)
  const menu = await messageMenu(page, ordinal)
  await expect(menu.getByText('Reply', {exact: true}), 'Reply in the text message menu').toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'message context menu')
  await closeMenu(page)
})

test('attachment fullscreen opens', async ({page}, testInfo) => {
  // e2e-media is seeded with images
  await openE2EChannel(page, E2E_CHANNELS.media)
  const images = page.getByTestId(T.CHAT_ATTACHMENT_IMAGE)
  await expect(images.last(), 'an image in e2e-media').toBeVisible({timeout: 10_000})
  await images.last().click()
  await expect(page.getByTestId(T.CHAT_ATTACHMENT_FULLSCREEN)).toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'attachment fullscreen')
  await closeModal(page)
  await expect(page.getByTestId(T.CHAT_ATTACHMENT_FULLSCREEN)).not.toBeVisible({timeout: 5_000})
})

test('bot install preview opens', async ({page}, testInfo) => {
  await openE2EChannel(page)
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
  await step(page, testInfo, 'bot install preview')
  await closeModal(page)
  await expect(installModal).not.toBeVisible({timeout: 5_000})
  // close the info panel again
  await page.locator('.icon-gen-iconfont-info:visible').first().click()
  await expect(page.getByTestId(T.CHAT_INFO_PANEL)).not.toBeVisible({timeout: 5_000})
})

test('bot search modal opens', async ({page}, testInfo) => {
  await openE2EChannel(page)
  await page.locator('.icon-gen-iconfont-info:visible').first().click()
  await expect(page.getByTestId(T.CHAT_INFO_PANEL)).toBeVisible({timeout: 5_000})
  await page.getByTestId(T.CHAT_INFO_PANEL).getByText('Bots', {exact: true}).click()
  await page.getByText('Add a bot', {exact: true}).click()
  const search = page.getByPlaceholder('Search featured bots or users...')
  await expect(search).toBeVisible({timeout: 10_000})
  await step(page, testInfo, 'bot search modal')
  await closeModal(page)
  await expect(search).not.toBeVisible({timeout: 5_000})
  await page.locator('.icon-gen-iconfont-info:visible').first().click()
  await expect(page.getByTestId(T.CHAT_INFO_PANEL)).not.toBeVisible({timeout: 5_000})
})

// Forward is offered only for attachments and messages with unfurls, so the test sends its own
// image (titled for the run) to e2e-scratch and opens that row's menu.
test('forward message picker opens', async ({page}, testInfo) => {
  test.setTimeout(60_000)
  await openE2EChannel(page)
  const title = `e2e-${e2eRunId()}-fwd-${Date.now().toString(36)}`
  await attachFromCli(E2E_CHANNELS.scratch, title)
  const ordinal = await waitForRow(page, title, 30_000)
  // the row's own "..." (hovered until it shows, clicked where nothing covers it), not a
  // right-click, which can land on the hover bar of the row above
  const menu = await messageMenu(page, ordinal)
  const forwardItem = menu.getByText('Forward', {exact: true})
  await expect(forwardItem, 'Forward in the image message menu').toBeVisible({timeout: 5_000})
  await forwardItem.click()
  const search = page.getByPlaceholder('Search chats and teams...')
  await expect(search).toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'forward message picker')
  await page.keyboard.press('Escape')
  await expect(search).not.toBeVisible({timeout: 5_000})
})
