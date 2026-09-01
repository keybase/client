import type {Page} from '@playwright/test'
import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {navigateToChat} from '@/tests/e2e/electron/helpers/navigate'
import * as T from '@/tests/e2e/shared/test-ids'

// Opening a conversation has to leave the reader on its newest message. It stopped doing that for
// threads whose rows grow a frame or two after the list has already landed - a link preview
// committing, an image measuring, the full thread response replacing the cached one. The list
// anchored to the end it could see, the content then grew past it, and the thread sat hundreds of
// pixels above the newest message. Measured in the app: it landed on an extent of 6891, the content
// committed 7224, and the thread stayed 432px short of the end.
//
// Image responses are held back so that growth lands after the initial scroll rather than before it,
// which is what makes this able to fail rather than passing on whatever the disk cache happened to
// have warm.
const IMAGE_DELAY_MS = 700
// A couple of pixels of sub-pixel residue is fine; anything more is a reader looking at old
// messages with the newest one off screen.
const MAX_DISTANCE_FROM_END = 8
// Threads shorter than their viewport cannot be short of their end, so they prove nothing.
const MIN_SCROLLABLE_OVERFLOW = 200

type ListMetrics = {clientHeight: number; distanceFromEnd: number; scrollHeight: number} | null

// The scroller is the list element LegendList renders inside the wrapper that carries the testID.
// Reached through globalThis because this suite's tsconfig has no DOM lib, the same way the app's
// desktop-only code does it.
const readListMetrics = async (page: Page): Promise<ListMetrics> =>
  page.evaluate((testID: string) => {
    type Scroller = {clientHeight: number; scrollHeight: number; scrollTop: number}
    const doc = (
      globalThis as unknown as {
        document?: {querySelector: (selector: string) => {firstElementChild?: Scroller | null} | null}
      }
    ).document
    const scroller = doc?.querySelector(`[data-testid="${testID}"]`)?.firstElementChild
    if (!scroller) return null
    return {
      clientHeight: Math.round(scroller.clientHeight),
      distanceFromEnd: Math.round(scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop),
      scrollHeight: Math.round(scroller.scrollHeight),
    }
  }, T.CHAT_MESSAGE_LIST)

// No retries. The growth this depends on lands a frame or two after the list does, so it is timing
// dependent by nature - and a retry that passes hides the regression the flow exists for. Verified:
// with the library fix disabled the first attempt failed and the retry passed.
test.describe.configure({retries: 0})

test('opens every conversation on its newest message', async ({page}) => {
  test.setTimeout(120_000)
  await navigateToChat(page)

  // Routing every request so the handler can pick the images out; everything else continues
  // untouched. Removed at the end because the page is shared with the rest of the suite.
  await page.route('**/*', async route => {
    if (route.request().resourceType() === 'image') {
      await new Promise(resolve => setTimeout(resolve, IMAGE_DELAY_MS))
    }
    await route.continue()
  })

  const checked: string[] = []
  try {
    // Team channels as well as one-to-ones: the threads with enough history to grow after landing
    // are mostly team channels, and the flow that found this bug was clicking through them.
    const rows = page.locator(
      `[data-testid="${T.CHAT_INBOX_CHANNEL_ROW}"], [data-testid="${T.CHAT_INBOX_ROW}"]`
    )
    const rowCount = Math.min(await rows.count(), 25)
    for (let i = 0; i < rowCount && checked.length < 5; i++) {
      const row = rows.nth(i)
      const name = (await row.innerText().catch(() => '')).split('\n')[0] ?? `row ${i}`
      // Open a neighbour first so the click below is a real open. The inbox row of the conversation
      // already on screen has no click handler at all (chat/inbox/row/small-team: onSelectConversation
      // is undefined when isSelected), so clicking it changes nothing - and a thread left parked in
      // its history by an earlier flow would be measured as if this test had just opened it. That is
      // what made this fail only when a search flow ran first and left its conversation open.
      if (rowCount > 1) {
        await rows
          .nth((i + 1) % rowCount)
          .click({force: true, timeout: 10_000})
          .catch(() => {})
        await page.waitForSelector(`[data-testid="${T.CHAT_MESSAGE_LIST}"]`, {timeout: 10_000})
        await page.waitForTimeout(500)
      }
      await row.click({force: true, timeout: 10_000}).catch(() => {})
      await page.waitForSelector(`[data-testid="${T.CHAT_MESSAGE_LIST}"]`, {timeout: 10_000})
      // Long enough for the delayed images to commit and for anything following the end to react.
      await page.waitForTimeout(IMAGE_DELAY_MS + 2_500)

      const metrics = await readListMetrics(page)
      if (!metrics || metrics.scrollHeight - metrics.clientHeight < MIN_SCROLLABLE_OVERFLOW) continue
      checked.push(name)
      expect(
        metrics.distanceFromEnd,
        `${name}: thread settled ${metrics.distanceFromEnd}px above its newest message (content ${metrics.scrollHeight}, viewport ${metrics.clientHeight})`
      ).toBeLessThanOrEqual(MAX_DISTANCE_FROM_END)
    }
  } finally {
    await page.unroute('**/*')
  }

  // Without this the loop above passes by never measuring a thread long enough to fail.
  expect(checked.length, 'no conversation had more content than its viewport, so nothing was checked').toBeGreaterThan(
    0
  )
})
