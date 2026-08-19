import type {Locator, Page} from '@playwright/test'
import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {navigateToChat} from '@/tests/e2e/electron/helpers/navigate'
import * as T from '@/tests/e2e/shared/test-ids'

// Opening a conversation directly onto one of its messages — the cold path.
//
// chat-search-hit covers the warm one: it opens a thread and then searches inside it, so the list
// has always rendered content by the time anything asks it to centre. The branch this covers is the
// other one — a thread mounting with a centred target already pending, which is what a permalink
// does. It is reached the way a reader reaches it, through the app's own affordances: copy a link to
// a message in conversation B, paste and send it in conversation A, click it. That routes through
// handleKeybaseLink -> previewConversation -> navigateToThread(..., highlightMessageID), which on
// desktop resets the chat root params and mounts a fresh thread. No OS-level deeplink needed.
//
// The link must point at a genuinely different conversation: navigateToThread takes a
// sameVisibleThread branch when the target is already on screen, and that branch does not remount,
// which is the warm path again.

// A row has to be visible by more than a hairline to count as landed on, matching chat-search-hit
// and the iOS flow.
// No retries. The second attempt runs against a thread this test has already fetched once, so a
// pass on retry would not be a pass on the path the first attempt took - the same reason
// chat-thread-bottom turns them off.
test.describe.configure({retries: 0})

const MIN_VISIBLE_HEIGHT = 24
// Centring is checked loosely on purpose. Sub-pixel precision is not the point — landing on the
// right message rather than at one end of the thread is. A third of the viewport either side of the
// middle still fails every way this can go wrong (top of the loaded window, bottom of the thread,
// off screen entirely).
const CENTRE_BAND_FRACTION = 1 / 3
// The target has to sit well above the newest message, or a thread that simply stayed at its end
// would pass without anything having jumped.
const MIN_DISTANCE_FROM_END = 1_200
// A conversation with less scrollable history than this cannot show the difference.
const MIN_SCROLLABLE_OVERFLOW = 1_500

// The scroller is the element LegendList renders inside the wrapper carrying the testID. Reached
// through the wrapper's first child, the same way chat-thread-bottom does it.
const distanceFromEnd = async (page: Page): Promise<number | undefined> =>
  page.evaluate((testID: string) => {
    type Scroller = {clientHeight: number; scrollHeight: number; scrollTop: number}
    const doc = (
      globalThis as unknown as {
        document?: {querySelector: (selector: string) => {firstElementChild?: Scroller | null} | null}
      }
    ).document
    const scroller = doc?.querySelector(`[data-testid="${testID}"]`)?.firstElementChild
    if (!scroller) return undefined
    return Math.round(scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop)
  }, T.CHAT_MESSAGE_LIST)

const scrollableOverflow = async (page: Page): Promise<number | undefined> =>
  page.evaluate((testID: string) => {
    type Scroller = {clientHeight: number; scrollHeight: number}
    const doc = (
      globalThis as unknown as {
        document?: {querySelector: (selector: string) => {firstElementChild?: Scroller | null} | null}
      }
    ).document
    const scroller = doc?.querySelector(`[data-testid="${testID}"]`)?.firstElementChild
    if (!scroller) return undefined
    return Math.round(scroller.scrollHeight - scroller.clientHeight)
  }, T.CHAT_MESSAGE_LIST)

// Inbox rows carry the conversation name on their first line. Matched exactly rather than with
// hasText: a row's second line is the latest message, and this flow sends a message that contains
// another conversation's name, so a substring match picks the wrong row from the second run on.
const rowName = async (row: Locator): Promise<string> =>
  (await row.innerText()).split('\n')[0]?.trim() ?? ''

const openConversationNamed = async (page: Page, rows: Locator, name: string): Promise<void> => {
  const count = await rows.count()
  for (let i = 0; i < count; i++) {
    const row = rows.nth(i)
    if ((await rowName(row)) !== name) continue
    await row.click({force: true, timeout: 10_000})
    await page.waitForSelector(`[data-testid="${T.CHAT_MESSAGE_LIST}"]`, {timeout: 10_000})
    await page.waitForTimeout(2_500)
    return
  }
  throw new Error(`no inbox row named "${name}"`)
}

test('opens a conversation onto the message a link points at', async ({page}) => {
  test.setTimeout(180_000)
  const smokeUser = process.env['KB_SMOKE_USER']
  expect(smokeUser, 'KB_SMOKE_USER is not set').toBeTruthy()

  await navigateToChat(page)
  const rows = page.locator(
    `[data-testid="${T.CHAT_INBOX_ROW}"], [data-testid="${T.CHAT_INBOX_CHANNEL_ROW}"]`
  )

  // B is discovered rather than hard-coded — a real username in a committed test would pin the suite
  // to one machine — but it is pinned by the name it turns out to have for the rest of the run, so
  // the second visit is provably the same conversation as the first.
  let convB = ''
  const rowCount = Math.min(await rows.count(), 12)
  for (let i = 0; i < rowCount && !convB; i++) {
    const name = await rowName(rows.nth(i))
    // A is the smoke account's own conversation: the one message this flow sends goes there.
    if (!name || name === smokeUser) continue
    await openConversationNamed(page, rows, name)
    const overflow = await scrollableOverflow(page)
    if (overflow !== undefined && overflow >= MIN_SCROLLABLE_OVERFLOW) convB = name
  }
  expect(convB, 'no conversation had enough history to jump within, so nothing was checked').toBeTruthy()

  // Scroll back through B until the newest message is far enough away, then take a row that is
  // wholly on screen and small enough to measure. `data-ordinal` is the app's own per-message
  // attribute; there is no testID for "a message row", and the ordinal is what the copied link
  // encodes, so it is also how the landing is checked at the other end.
  const listBox = await page.getByTestId(T.CHAT_MESSAGE_LIST).first().boundingBox()
  expect(listBox, 'the message list has no box').not.toBeNull()
  await page.mouse.move(listBox!.x + listBox!.width / 2, listBox!.y + listBox!.height / 2)

  let targetOrdinal = ''
  let targetRow: Locator | undefined
  for (let attempt = 0; attempt < 30 && !targetRow; attempt++) {
    await page.mouse.wheel(0, -600)
    await page.waitForTimeout(250)
    if (((await distanceFromEnd(page)) ?? 0) < MIN_DISTANCE_FROM_END) continue
    await page.waitForTimeout(500)
    const candidates = page.locator('[data-ordinal]')
    const n = await candidates.count()
    for (let i = 0; i < n; i++) {
      const candidate = candidates.nth(i)
      const box = await candidate.boundingBox()
      if (!box) continue
      const text = (await candidate.innerText()).trim()
      const wholly = box.y >= listBox!.y + 20 && box.y + box.height <= listBox!.y + listBox!.height - 20
      // Media rows are taller than the viewport's usable band and often have no text to identify
      // them by, so a short text row is the honest handle here.
      if (box.height > 250 || !wholly || text.length < 6) continue
      targetOrdinal = (await candidate.getAttribute('data-ordinal')) ?? ''
      targetRow = candidate
      break
    }
  }
  expect(targetRow, `no message in "${convB}" was far enough above its newest one to link to`).toBeTruthy()

  await targetRow!.hover()
  await targetRow!.getByTestId(T.CHAT_MESSAGE_MENU_BUTTON).first().click({force: true, timeout: 10_000})
  await page.getByText('Copy a link to this message').first().click({timeout: 10_000})
  await page.waitForTimeout(700)

  // Pasting rather than typing the link out: the copy above put it on the real clipboard and there
  // is no way to read that back from the renderer (clipboard-read permission is denied in the app),
  // so the paste both delivers it and reveals what was copied. A plain Meta+V is a synthetic key
  // event the renderer ignores; the editing command has to be attached to it.
  await openConversationNamed(page, rows, smokeUser!)
  const input = page.getByTestId(T.CHAT_INPUT)
  await input.click()
  await input.fill('')
  const cdp = await page.context().newCDPSession(page)
  const key = {code: 'KeyV', key: 'v', modifiers: 4, nativeVirtualKeyCode: 86, windowsVirtualKeyCode: 86}
  await cdp.send('Input.dispatchKeyEvent', {...key, commands: ['paste'], type: 'keyDown'})
  await cdp.send('Input.dispatchKeyEvent', {...key, type: 'keyUp'})
  await page.waitForTimeout(600)
  const link = await input.inputValue()
  expect(link, 'the message menu did not put a keybase chat link on the clipboard').toMatch(
    new RegExp(`^keybase://chat/.+/${targetOrdinal}$`)
  )
  await input.press('Enter')

  const sentLink = page.locator(`[data-testid="${T.CHAT_MESSAGE_LIST}"]`).getByText(link, {exact: true})
  await expect(sentLink.last()).toBeVisible({timeout: 15_000})
  await sentLink.last().click()

  // The thread this lands in is a fresh mount with a centred target already pending. Poll rather
  // than sleep once: the centred fetch clears and refetches the thread, so the row arrives well
  // after the navigation does.
  const hit = page.getByTestId(T.CHAT_SEARCH_HIT).first()
  await expect(
    hit,
    `clicking the link to ${link} never landed on the message: the thread settled ${await distanceFromEnd(page)}px from its end without the target on screen`
  ).toBeVisible({timeout: 20_000})
  // Let any late row measurement settle before reading positions, the same way the search flow does.
  await page.waitForTimeout(2_000)

  // We really did leave A: the link message is A's newest and would still be rendered if we had not.
  await expect(sentLink).toHaveCount(0)

  const hitBox = await hit.boundingBox({timeout: 5_000})
  const listAfter = await page.getByTestId(T.CHAT_MESSAGE_LIST).first().boundingBox()
  expect(hitBox, 'the linked message was highlighted but had no box, so nothing was measured').not.toBeNull()
  expect(listAfter, 'the message list has no box').not.toBeNull()

  const visibleHeight =
    Math.min(hitBox!.y + hitBox!.height, listAfter!.y + listAfter!.height) - Math.max(hitBox!.y, listAfter!.y)
  expect(
    visibleHeight >= Math.min(hitBox!.height, MIN_VISIBLE_HEIGHT),
    `the linked message is outside the list: hit y=${Math.round(hitBox!.y)} h=${Math.round(hitBox!.height)}, list y=${Math.round(listAfter!.y)} h=${Math.round(listAfter!.height)}`
  ).toBe(true)

  const offCentre = Math.abs(
    hitBox!.y + hitBox!.height / 2 - (listAfter!.y + listAfter!.height / 2)
  )
  expect(
    offCentre,
    `the linked message landed ${Math.round(offCentre)}px from the middle of the list (viewport ${Math.round(listAfter!.height)}px)`
  ).toBeLessThanOrEqual(listAfter!.height * CENTRE_BAND_FRACTION)
})
