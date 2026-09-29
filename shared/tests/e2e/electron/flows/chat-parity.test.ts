// Desktop behaviour the phone shares: the pinned banner steps aside for thread search, every Reply
// closes search and hands the composer focus, and an inline video plays once and opens fullscreen
// from its corner button or a double-click.
import type {Locator, Page} from '@playwright/test'
import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
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
      .filter({has: page.getByTestId(T.CHAT_VIDEO_FULLSCREEN)})
      .last()

  type VideoState = {currentTime: number; duration: number; ended: boolean; loop: boolean; paused: boolean}
  const videoState = async (row: Locator) =>
    row.locator('video').evaluate(el => {
      const v = el as unknown as VideoState
      return {currentTime: v.currentTime, duration: v.duration, ended: v.ended, loop: v.loop, paused: v.paused}
    })

  // The video's own box: the poster (its image, the play icon over it, the duration and the corner
  // button) until it plays, then the video. The corner button sits in both.
  const poster = (row: Locator) => row.getByTestId(T.CHAT_VIDEO_FULLSCREEN).locator('xpath=../..')

  // The fullscreen view's Escape handler registers a render after it shows, so an Escape pressed in
  // that gap is dropped: press again until it closes (as closeMenu does).
  const closeFullscreen = async (page: Page) => {
    await expect(async () => {
      await page.keyboard.press('Escape')
      await expect(fullscreen(page)).toHaveCount(0, {timeout: 500})
    }).toPass({timeout: 5_000})
  }

  // opened fresh, so the video starts on its poster
  test.beforeEach(async ({page}) => {
    await openConversationByName(page, data.team, E2E_CHANNELS.scratch)
    await openConversationByName(page, data.team, E2E_CHANNELS.media)
    await waitForScrollStable(page)
    await expect(videoRow(page)).toHaveCount(1, {timeout: 10_000})
  })

  test.afterEach(async ({page}) => {
    if (await fullscreen(page).count()) await closeFullscreen(page)
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

  test('the corner button opens the video fullscreen', async ({page}) => {
    const row = videoRow(page)
    await clickUnoccluded(row.getByTestId(T.CHAT_VIDEO_FULLSCREEN))
    await expect(fullscreen(page)).toBeVisible({timeout: 10_000})
    await closeFullscreen(page)
    // the inline one went back to its poster
    await expect(row.locator('video')).toHaveCount(0)
  })

  // A double-click at a point on the video, as a fraction of its height. Chromium's own controls
  // put a play button over the middle of a video, which is why the flows below aim above it.
  const doubleClickAt = async (page: Page, row: Locator, fy: number) => {
    const box = await poster(row).boundingBox({timeout: 5_000})
    if (!box) throw new Error('the video has no box')
    await page.mouse.dblclick(box.x + box.width * 0.6, box.y + box.height * fy)
  }

  test('double-clicking the video poster opens it fullscreen', async ({page}) => {
    const row = videoRow(page)
    // the first click starts the video, the second lands on the video that replaced the poster
    await doubleClickAt(page, row, 0.3)
    await expect(fullscreen(page)).toBeVisible({timeout: 10_000})
    await closeFullscreen(page)
    await expect(row.locator('video')).toHaveCount(0)
  })

  test('double-clicking a playing video opens it fullscreen', async ({page}) => {
    const row = videoRow(page)
    await clickUnoccluded(poster(row))
    await expect(row.locator('video')).toHaveCount(1, {timeout: 5_000})
    await doubleClickAt(page, row, 0.3)
    await expect(fullscreen(page)).toBeVisible({timeout: 10_000})
    await closeFullscreen(page)
    await expect(row.locator('video')).toHaveCount(0)
  })

  // App bug (integration build): a double-click in the middle of a playing video never reaches the
  // video's onDoubleClick. Chromium's native controls draw their play button there and take both
  // clicks: document-level capture listeners see no mousedown, click or dblclick at that point,
  // while 30% down the same video they see all three and fullscreen opens. The same goes for a
  // double-click in the middle of the poster: the first click starts the video, and the second
  // lands on that play button. Remove test.fail once fixed.
  test('double-clicking the middle of a playing video opens it fullscreen', async ({page}) => {
    test.fail()
    const row = videoRow(page)
    await clickUnoccluded(poster(row))
    await expect(row.locator('video')).toHaveCount(1, {timeout: 5_000})
    await doubleClickAt(page, row, 0.5)
    await expect(fullscreen(page)).toBeVisible({timeout: 5_000})
  })
})
