// Desktop behaviour the phone shares: the pinned banner steps aside for thread search, every Reply
// closes search and hands the composer focus, and an inline video plays once. Desktop's fullscreen is
// the player's own control, so its double-click goes to Chromium, not to the attachment view.
import type {Locator, Page} from '@playwright/test'
import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {checkRendererAfterReload} from '@/tests/e2e/electron/helpers/connect'
import {
  clickUnoccluded,
  closeSearch,
  composerInput,
  messageMenu,
  openConversationByName,
  openThreadSearch,
  rowByOrdinal,
  sendMessage,
  threadSearch,
  waitForScrollStable,
} from '@/tests/e2e/electron/helpers/chat'
import {E2E_CHANNELS, ensureChatData, type ChatData} from '@/tests/e2e/shared/chat-data'
import * as T from '@/tests/e2e/shared/test-ids'

// no retries: a retry would let an intermittent race pass
test.describe.configure({retries: 0})

let data: ChatData

test.beforeAll(async () => {
  test.setTimeout(20 * 60_000) // a first run seeds; later runs only check
  data = await ensureChatData()
})

const pinnedBanner = (page: Page) => page.getByTestId(T.CHAT_PINNED_BANNER)
const replyPreview = (page: Page) => page.getByTestId(T.CHAT_REPLY_PREVIEW)

// Unpins whatever is pinned in the open conversation. The smoke user pins everything these flows
// pin, so the banner's close asks to unpin for everyone.
const unpin = async (page: Page) => {
  if (!(await pinnedBanner(page).count())) return
  await clickUnoccluded(pinnedBanner(page).locator('.icon-gen-iconfont-close'))
  const confirm = page.getByText('Yes, unpin', {exact: true})
  await expect(confirm).toBeVisible({timeout: 5_000})
  // the confirm popup ignores a choice within 100ms of showing (see messageMenu)
  await page.waitForTimeout(150)
  await clickUnoccluded(confirm)
  await expect(pinnedBanner(page)).toHaveCount(0, {timeout: 10_000})
}

test.describe('pinned banner', () => {
  test.afterEach(async ({page}) => {
    if (await threadSearch(page).count()) await closeSearch(page)
    await unpin(page)
  })

  test('the pinned banner hides while thread search is open', async ({page}) => {
    await openConversationByName(page, data.team, E2E_CHANNELS.scratch)
    await unpin(page)
    const text = `e2e-parity-pin-${Date.now()}`
    const ordinal = await sendMessage(page, text)

    const menu = await messageMenu(page, ordinal)
    await clickUnoccluded(menu.getByText('Pin message', {exact: true}))
    await expect(pinnedBanner(page)).toBeVisible({timeout: 10_000})
    await expect(pinnedBanner(page)).toContainText(text, {timeout: 5_000})

    await openThreadSearch(page)
    await expect(pinnedBanner(page)).toHaveCount(0, {timeout: 5_000})

    await closeSearch(page)
    await expect(pinnedBanner(page)).toBeVisible({timeout: 5_000})
    await expect(pinnedBanner(page)).toContainText(text)
  })
})

test.describe('reply', () => {
  test.afterEach(async ({page}) => {
    if (await threadSearch(page).count()) await closeSearch(page)
    if (await replyPreview(page).count()) {
      await clickUnoccluded(page.getByTestId(T.CHAT_REPLY_CANCEL))
    }
    await expect(replyPreview(page)).toHaveCount(0, {timeout: 5_000})
  })

  // Opens search, then starts a reply to `text`'s row through `reply`, and checks the reply opened
  // the same way: the reply bar names the message, search is closed, the composer has focus.
  const replyClosesSearchAndFocuses = async (page: Page, reply: (row: Locator, ordinal: number) => Promise<void>) => {
    await openConversationByName(page, data.team, E2E_CHANNELS.scratch)
    const text = `e2e-parity-reply-${Date.now()}`
    const ordinal = await sendMessage(page, text)
    await openThreadSearch(page)
    await expect(threadSearch(page)).toBeVisible()
    await waitForScrollStable(page)

    await reply(rowByOrdinal(page, ordinal), ordinal)

    await expect(replyPreview(page)).toBeVisible({timeout: 5_000})
    await expect(replyPreview(page)).toContainText('Replying to', {timeout: 5_000})
    await expect(replyPreview(page)).toContainText(text)
    await expect(threadSearch(page)).toHaveCount(0, {timeout: 5_000})
    await expect(composerInput(page)).toBeFocused({timeout: 5_000})
  }

  test('Reply from the row hover bar closes search and focuses the composer', async ({page}) => {
    await replyClosesSearchAndFocuses(page, async row => {
      await row.hover({timeout: 5_000})
      await clickUnoccluded(row.locator('.icon-gen-iconfont-reply').first())
    })
  })

  test('Reply from the message menu closes search and focuses the composer', async ({page}) => {
    await replyClosesSearchAndFocuses(page, async (_row, ordinal) => {
      const menu = await messageMenu(page, ordinal)
      await clickUnoccluded(menu.getByText('Reply', {exact: true}))
    })
  })
})

test.describe('inline video', () => {
  const fullscreen = (page: Page) => page.getByTestId(T.CHAT_ATTACHMENT_FULLSCREEN)

  // The seeded video's row, and the video inside it once it plays.
  const videoRow = (page: Page) =>
    page
      .getByTestId(T.CHAT_MESSAGE_LIST)
      .locator('[data-ordinal]')
      .filter({hasText: 'e2e-media-video-tall'})
      .last()

  type VideoState = {currentTime: number; duration: number; ended: boolean; loop: boolean; paused: boolean}
  const videoState = async (row: Locator) =>
    row.locator('video').evaluate(el => {
      const v = el as unknown as VideoState
      return {currentTime: v.currentTime, duration: v.duration, ended: v.ended, loop: v.loop, paused: v.paused}
    })

  // The poster (its image, the play icon over it and the duration, 'm:ss, size') until the video plays.
  const poster = (row: Locator) => row.getByText(/^\d+:\d{2}\b/).locator('xpath=../..')

  type FullscreenDoc = {fullscreenElement: {tagName: string} | null}
  const fullscreenTag = async (page: Page) =>
    page.evaluate(() => (document as unknown as FullscreenDoc).fullscreenElement?.tagName ?? null)

  // opened fresh, so the video starts on its poster
  test.beforeEach(async ({page}) => {
    await openConversationByName(page, data.team, E2E_CHANNELS.scratch)
    await openConversationByName(page, data.team, E2E_CHANNELS.media)
    await waitForScrollStable(page)
    await expect(videoRow(page)).toHaveCount(1, {timeout: 10_000})
  })

  // Driven input puts the video fullscreen within the window, not the window itself, and no exit
  // (exitFullscreen(), Escape, the controls) leaves that state; a real Escape or double-click does.
  // A reload is the one way back.
  test.afterEach(async ({page}) => {
    if (await fullscreenTag(page)) await checkRendererAfterReload(page)
  })

  test('an inline video plays once to its end and stops there', async ({page}) => {
    const row = videoRow(page)
    await expect(row.locator('video')).toHaveCount(0)
    await clickUnoccluded(poster(row))
    await expect(row.locator('video')).toHaveCount(1, {timeout: 5_000})

    await expect.poll(async () => (await videoState(row)).ended, {timeout: 15_000}).toBe(true)
    const ended = await videoState(row)
    expect(ended.loop).toBe(false)
    expect(ended.paused).toBe(true)
    // it stays at its end rather than starting over
    await page.waitForTimeout(1_000)
    const later = await videoState(row)
    expect(later.ended).toBe(true)
    expect(later.currentTime).toBe(ended.currentTime)
  })

  test('the playing video keeps its own fullscreen control and no corner button', async ({page}) => {
    const row = videoRow(page)
    await expect(row.getByTestId(T.CHAT_VIDEO_FULLSCREEN)).toHaveCount(0)
    await clickUnoccluded(poster(row))
    await expect(row.locator('video')).toHaveCount(1, {timeout: 5_000})
    await expect(row.getByTestId(T.CHAT_VIDEO_FULLSCREEN)).toHaveCount(0)
    expect(await row.locator('video').getAttribute('controlslist')).not.toMatch(/nofullscreen/)
  })

  // The seeded video previews 320px tall, so 0.3 of the way down sits above Chromium's own controls
  // panel (the bottom ~72px of a video, where a press is consumed by the controls).
  test('double-clicking a playing video puts the video itself fullscreen', async ({page}) => {
    const row = videoRow(page)
    await clickUnoccluded(poster(row))
    const video = row.locator('video')
    await expect(video).toHaveCount(1, {timeout: 5_000})
    const box = await video.boundingBox({timeout: 5_000})
    if (!box) throw new Error('the video has no box')
    await page.mouse.dblclick(box.x + box.width * 0.6, box.y + box.height * 0.3)
    await expect.poll(async () => fullscreenTag(page), {timeout: 5_000}).toBe('VIDEO')
    await expect(fullscreen(page)).toHaveCount(0)
  })
})
