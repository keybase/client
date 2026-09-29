// Where the desktop thread scrolls, read off the DOM: opening lands at the bottom, new messages keep
// a reader at the bottom there and leave one in history where they are, search hits centre and let
// the reader take over, pages load in both directions without moving the reader, and the list
// keeps its place across an edit, a mark unread and a tab switch.
import type {Page} from '@playwright/test'
import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {
  clickUnoccluded,
  closeSearch,
  composer,
  composerInput,
  dragScrollbar,
  endTolerancePx,
  focusThreadScroller,
  isOrdinalCentred,
  messageMenu,
  openConversationByName,
  openThreadSearch,
  ordinalRect,
  readThreadGeometry,
  rowByOrdinal,
  searchFor,
  selectHit,
  sendMessage,
  threadSearch,
  waitForRow,
  waitForScrollStable,
  wheelThread,
  type ThreadGeometry,
} from '@/tests/e2e/electron/helpers/chat'
import {
  E2E_CHANNELS,
  LONG_COUNT,
  LONG_SEARCH_TOKENS,
  SHORT_COUNT,
  ensureChatData,
  longMarker,
  shortMarker,
  type ChatData,
  type E2EChannel,
} from '@/tests/e2e/shared/chat-data'
import {findIncomingSender, type IncomingSender} from '@/tests/e2e/shared/incoming-sender'
import * as T from '@/tests/e2e/shared/test-ids'

let data: ChatData
let sender: IncomingSender

test.beforeAll(async () => {
  test.setTimeout(20 * 60_000) // a first run seeds; later runs only check
  data = await ensureChatData()
  sender = await findIncomingSender(data.secondUser)
})

// How far a row the reader was looking at may drift across a page load: rows measure to fractional
// pixels, and the list holds content in place to within a few of them. Scrolling up is looser
// between page loads: rows scrolled into view from above render at the list's estimated height
// (72px) and then measure at their real one, and the rows below them in view move by the
// difference (17.5px on a typical 600px wheel here, 103px where the three short system messages
// at the very top of the thread come in). That happens on master too (same list, same estimate).
const anchorTolerancePx = 12
// The list's own centring settles within 8px of the middle.
const centreTolerancePx = 16

const jumpToRecent = (page: Page) => page.getByTestId(T.CHAT_JUMP_TO_RECENT)
const catchUp = (page: Page) => page.getByTestId(T.CHAT_CATCH_UP)

const requireSender = () => {
  test.skip(!sender.ok, sender.ok ? '' : `second-account sender unavailable: ${sender.reason}`)
  if (!sender.ok) throw new Error('unreachable')
  return sender
}

const sendIncoming = async (channel: E2EChannel, text: string) => {
  await requireSender().send(data.convIDs[channel], data.team, text)
}

// A row wholly in view, at least `margin` px inside both edges, for the reader to be looking at.
const pickAnchor = (g: ThreadGeometry, margin: number) => {
  const row = g.rows.find(r => r.top >= margin && r.bottom <= g.viewHeight - margin)
  if (!row) throw new Error(`no row wholly in view with a ${margin}px margin`)
  return row
}

const rowTop = (g: ThreadGeometry, ordinal: number) => g.rows.find(r => r.ordinal === ordinal)?.top

// The ordinal of the newest row rendered, once the list has settled.
const newestRendered = (g: ThreadGeometry) => g.rows.at(-1)?.ordinal ?? -1

// Opens `channel` fresh: the thread is switched away from first, so the list mounts and loads anew.
const openFresh = async (page: Page, channel: E2EChannel) => {
  const away = channel === E2E_CHANNELS.scratch ? E2E_CHANNELS.media : E2E_CHANNELS.scratch
  await openConversationByName(page, data.team, away)
  await openConversationByName(page, data.team, channel)
}

// A reading short enough for an assertion message.
const summary = (g: ThreadGeometry) =>
  JSON.stringify({
    clientHeight: g.clientHeight,
    distanceFromEnd: g.distanceFromEnd,
    newest: g.rows.at(-1),
    oldest: g.rows[0],
    rows: g.rows.length,
    scrollHeight: g.scrollHeight,
    scrollTop: g.scrollTop,
  })

const expectAtEnd = async (page: Page) => {
  const g = await waitForScrollStable(page)
  expect(g.distanceFromEnd, `distance from the end: ${summary(g)}`).toBeLessThanOrEqual(endTolerancePx)
  return g
}

const openScratchAtEnd = async (page: Page) => {
  await openFresh(page, E2E_CHANNELS.scratch)
  return expectAtEnd(page)
}

// Selects the first hit for `token` and waits for its row; returns the row's ordinal.
const searchAndSelect = async (page: Page, token: string, marker: string) => {
  await openThreadSearch(page)
  const hits = await searchFor(page, token)
  expect(hits).toHaveLength(1)
  await selectHit(page, 0)
  return waitForRow(page, marker)
}

const expectCentred = async (page: Page, ordinal: number) => {
  await expect
    .poll(async () => (await isOrdinalCentred(page, ordinal, centreTolerancePx)).offset, {timeout: 10_000})
    .toBeLessThanOrEqual(centreTolerancePx)
  await waitForScrollStable(page)
  const {centred, offset} = await isOrdinalCentred(page, ordinal, centreTolerancePx)
  expect(centred, `row ${ordinal} centred (offset ${offset})`).toBe(true)
}

test.describe('opening', () => {
  test('a short thread lands at the bottom once its intro card has grown the header', async ({page}) => {
    // Every message of e2e-short arrives in the first page, so the header's intro card (the
    // new-chat card) renders after the rows and grows the header above them.
    await openFresh(page, E2E_CHANNELS.short)
    const newest = await waitForRow(page, shortMarker(SHORT_COUNT))
    await expect(page.getByTestId(T.CHAT_MESSAGE_LIST).getByText('This conversation is end-to-end encrypted.')).toHaveCount(1, {timeout: 10_000})
    const g = await expectAtEnd(page)
    expect(g.scrollHeight).toBeGreaterThan(g.clientHeight)
    const rect = await ordinalRect(page, newest)
    expect(Math.abs((rect?.bottom ?? 0) - g.viewHeight)).toBeLessThanOrEqual(40)
  })

  test('a long thread with more history to load lands at the bottom', async ({page}) => {
    await openFresh(page, E2E_CHANNELS.long)
    const newest = await waitForRow(page, longMarker(LONG_COUNT))
    const g = await expectAtEnd(page)
    expect(newestRendered(g)).toBe(newest)
  })
})

test.describe('new messages', () => {
  test('at the bottom, an incoming message keeps the thread at the bottom', async ({page}) => {
    requireSender()
    await openScratchAtEnd(page)
    const text = `e2e-scroll-incoming-bottom-${Date.now()}`
    await sendIncoming(E2E_CHANNELS.scratch, text)
    const ordinal = await waitForRow(page, text, 20_000)
    const g = await expectAtEnd(page)
    expect(newestRendered(g)).toBe(ordinal)
  })

  for (const {name, up} of [
    // within a tenth of the viewport of the end, which the list's own end anchor would call the end
    {name: 'a little way', up: 60},
    {name: 'well', up: 500},
  ]) {
    test(`scrolled ${name} up, an incoming message leaves the reader where they are`, async ({page}) => {
      requireSender()
      await openScratchAtEnd(page)
      await wheelThread(page, -up)
      const before = await waitForScrollStable(page)
      expect(before.distanceFromEnd).toBeGreaterThan(up / 2)
      const anchor = pickAnchor(before, 40)

      await sendIncoming(E2E_CHANNELS.scratch, `e2e-scroll-incoming-up-${Date.now()}`)
      await expect
        .poll(async () => (await readThreadGeometry(page))?.scrollHeight ?? 0, {timeout: 20_000})
        .toBeGreaterThan(before.scrollHeight)
      const after = await waitForScrollStable(page)
      const top = rowTop(after, anchor.ordinal)
      expect(top, `row ${anchor.ordinal} still rendered`).toBeDefined()
      expect(Math.abs((top ?? 0) - anchor.top), `row ${anchor.ordinal} moved`).toBeLessThanOrEqual(2)
      expect(after.distanceFromEnd).toBeGreaterThan(before.distanceFromEnd)
    })
  }
})

test.describe('search', () => {
  test('a deep hit loads its page and is centred', async ({page}) => {
    await openFresh(page, E2E_CHANNELS.long)
    await expectAtEnd(page)
    const {index, token} = LONG_SEARCH_TOKENS.deep
    // the hit is far older than the first page the thread loaded
    await expect(page.getByTestId(T.CHAT_MESSAGE_LIST).getByText(longMarker(index))).toHaveCount(0)
    const ordinal = await searchAndSelect(page, token, longMarker(index))
    await expectCentred(page, ordinal)
    await closeSearch(page)
  })

  test('selecting the same hit again after scrolling away centres it again', async ({page}) => {
    await openFresh(page, E2E_CHANNELS.long)
    const {index, token} = LONG_SEARCH_TOKENS.middle
    const ordinal = await searchAndSelect(page, token, longMarker(index))
    await expectCentred(page, ordinal)

    await wheelThread(page, 900)
    await waitForScrollStable(page)
    expect((await isOrdinalCentred(page, ordinal, centreTolerancePx)).centred).toBe(false)

    await selectHit(page, 0)
    await expectCentred(page, ordinal)
    await closeSearch(page)
  })

  // Each way the reader can move the list, done the moment the hit's row lands, while the list is
  // still centring it. The reader's move wins: the list stays where it left it and is not pulled
  // back to the hit.
  const readerMoves: Array<{how: string; move: (page: Page) => Promise<void>}> = [
    {how: 'a wheel', move: async page => wheelThread(page, -300)},
    {
      how: 'Page Up in the composer',
      move: async page => {
        await composerInput(page).press('PageUp', {timeout: 5_000})
      },
    },
    // the centring's own scroll has just shown the overlay scrollbar
    {how: 'a scrollbar drag', move: async page => dragScrollbar(page, -60)},
  ]
  for (const {how, move} of readerMoves) {
    test(`${how} during centring stops it`, async ({page}) => {
      await openFresh(page, E2E_CHANNELS.long)
      await expectAtEnd(page)
      const {index, token} = LONG_SEARCH_TOKENS.middle
      await openThreadSearch(page)
      await searchFor(page, token)
      await selectHit(page, 0)
      const ordinal = await waitForRow(page, longMarker(index))
      // The hit's page lands with the list at its top; move only once the list has started for the
      // hit, while its centring is still under way. A reader's move before that finds the list
      // pinned at the top, where an upward move changes nothing.
      await page.waitForFunction(
        testID => {
          type Scroller = {scrollTop: number}
          const g = globalThis as unknown as {
            document: {querySelector: (s: string) => {children: ArrayLike<Scroller>} | null}
            getComputedStyle: (el: Scroller) => {overflowY: string}
          }
          const wrapper = g.document.querySelector(`[data-testid="${testID}"]`)
          const scroller = wrapper && Array.from(wrapper.children).find(c => /auto|scroll/.test(g.getComputedStyle(c).overflowY))
          return !!scroller && scroller.scrollTop > 0
        },
        T.CHAT_MESSAGE_LIST,
        {polling: 'raf', timeout: 5_000}
      )
      await move(page)
      const moved = await waitForScrollStable(page)
      const offsetAfterMove = (await isOrdinalCentred(page, ordinal, centreTolerancePx)).offset
      // outlast the centring's own 3s budget, then check nothing pulled the reader back
      await page.waitForTimeout(3_500)
      const later = await waitForScrollStable(page)
      expect(Math.abs(later.scrollTop - moved.scrollTop), 'the list moved after the reader did').toBeLessThanOrEqual(2)
      const {centred, offset} = await isOrdinalCentred(page, ordinal, centreTolerancePx)
      expect(centred, `row ${ordinal} pulled back to the middle (offset ${offset}, after the move ${offsetAfterMove})`).toBe(false)
      await closeSearch(page)
    })
  }

  test('closing search leaves the list where it is', async ({page}) => {
    await openFresh(page, E2E_CHANNELS.long)
    const {index, token} = LONG_SEARCH_TOKENS.middle
    const ordinal = await searchAndSelect(page, token, longMarker(index))
    await expectCentred(page, ordinal)
    const before = await waitForScrollStable(page)
    const top = rowTop(before, ordinal)

    await closeSearch(page)
    const after = await waitForScrollStable(page)
    expect(Math.abs((rowTop(after, ordinal) ?? Infinity) - (top ?? 0))).toBeLessThanOrEqual(2)
    expect(after.distanceFromEnd).toBeGreaterThan(endTolerancePx)
  })

  test('jump to recent from a deep hit lands at the newest message', async ({page}) => {
    await openFresh(page, E2E_CHANNELS.long)
    const {index, token} = LONG_SEARCH_TOKENS.deep
    const ordinal = await searchAndSelect(page, token, longMarker(index))
    await expectCentred(page, ordinal)

    await clickUnoccluded(jumpToRecent(page))
    const newest = await waitForRow(page, longMarker(LONG_COUNT), 15_000)
    const g = await expectAtEnd(page)
    expect(newestRendered(g)).toBe(newest)
    await expect(jumpToRecent(page)).toHaveCount(0, {timeout: 5_000})
    await expect(threadSearch(page)).toHaveCount(0, {timeout: 5_000})
  })
})

// Pages that load while the reader scrolls land out of sight: a row the reader was looking at moves
// exactly as far as the reader scrolled, however many rows arrived. Steps where no page loaded are
// held to that too when everyStep is set; scrolling up they are not, as rows scrolled into view
// from above swap their estimated height for their real one (see remeasureTolerancePx). Returns
// how many times the content grew by more than a page's worth of height.
const scrollThroughPages = async (
  page: Page,
  step: number,
  everyStep: boolean,
  done: (g: ThreadGeometry) => boolean
) => {
  let g = await waitForScrollStable(page)
  let pageLoads = 0
  for (let i = 0; i < 60 && !done(g); i++) {
    const before = g
    // a row wholly in view before the step that stays wholly in view after it
    const anchor = before.rows.find(r =>
      step > 0 ? r.top >= step + 20 && r.bottom <= before.viewHeight : r.top >= 0 && r.bottom <= before.viewHeight + step - 20
    )
    if (!anchor) throw new Error(`step ${i}: no row in view to anchor on`)
    // the scroller clamps at either end of what has loaded so far
    const room = step > 0 ? before.distanceFromEnd : before.scrollTop
    const expected = Math.min(Math.abs(step), room) * Math.sign(step)
    await wheelThread(page, step)
    g = await waitForScrollStable(page)
    const pageLoaded = Math.abs(g.scrollHeight - before.scrollHeight) > 1000
    if (pageLoaded) pageLoads++
    const top = rowTop(g, anchor.ordinal)
    expect(top, `step ${i}: row ${anchor.ordinal} left the view`).toBeDefined()
    const moved = anchor.top - (top ?? 0)
    if (pageLoaded || everyStep) {
      expect(
        Math.abs(moved - expected),
        `step ${i}: row ${anchor.ordinal} moved ${moved}px for a ${expected}px scroll${pageLoaded ? ' as a page loaded' : ''}`
      ).toBeLessThanOrEqual(anchorTolerancePx)
    }
  }
  expect(done(g), 'reached the end of the scroll').toBe(true)
  return pageLoads
}

test.describe('paging', () => {
  test('scrolling up loads older pages without moving the reader, back to the first message', async ({page}) => {
    test.setTimeout(120_000)
    await openFresh(page, E2E_CHANNELS.long)
    await expectAtEnd(page)
    const oldest = longMarker(1)
    const pageLoads = await scrollThroughPages(
      page,
      -600,
      false,
      g => g.scrollTop === 0 && g.rows.length > 0 && g.rows[0]!.top >= -1
    )
    // 400 messages, 100 in the first load and 100 per page after
    expect(pageLoads).toBeGreaterThanOrEqual(3)
    await waitForRow(page, oldest)
  })

  test('scrolling down from an old hit loads newer pages without jumps until the present', async ({page}) => {
    test.setTimeout(120_000)
    await openFresh(page, E2E_CHANNELS.long)
    const {index, token} = LONG_SEARCH_TOKENS.deep
    const ordinal = await searchAndSelect(page, token, longMarker(index))
    await expectCentred(page, ordinal)
    await closeSearch(page)
    await expect(jumpToRecent(page)).toBeVisible({timeout: 5_000})

    const newestMarker = longMarker(LONG_COUNT)
    const pageLoads = await scrollThroughPages(
      page,
      500,
      true,
      g => g.distanceFromEnd <= endTolerancePx && newestRendered(g) > 0 && !!g.rows.length
        && g.rows.at(-1)!.bottom <= g.viewHeight + 1
    )
    expect(pageLoads).toBeGreaterThanOrEqual(3)
    await waitForRow(page, newestMarker)
    await expectAtEnd(page)
    await expect(jumpToRecent(page)).toHaveCount(0, {timeout: 5_000})
  })
})

test.describe('back to the bottom', () => {
  const ways: Array<{how: string; toBottom: (page: Page) => Promise<void>}> = [
    {
      how: 'End on the thread',
      toBottom: async page => {
        await focusThreadScroller(page)
        await page.keyboard.press('End')
      },
    },
    {
      how: 'Page Down in the composer',
      toBottom: async page => {
        await composer.focus(page)
        for (let i = 0; i < 4; i++) {
          await composer.press(page, 'PageDown')
        }
      },
    },
    {how: 'the scrollbar', toBottom: async page => dragScrollbar(page, 2_000, {nudge: true})},
  ]
  for (const {how, toBottom} of ways) {
    test(`${how} re-pins it, and a later incoming message keeps the bottom`, async ({page}) => {
      requireSender()
      const atEnd = await openScratchAtEnd(page)
      await wheelThread(page, -800)
      const up = await waitForScrollStable(page)
      expect(up.distanceFromEnd, `after the wheel: ${summary(up)}; before: ${summary(atEnd)}`).toBeGreaterThan(400)

      await toBottom(page)
      await expectAtEnd(page)

      const text = `e2e-scroll-repin-${Date.now()}`
      await sendIncoming(E2E_CHANNELS.scratch, text)
      const ordinal = await waitForRow(page, text, 20_000)
      const g = await expectAtEnd(page)
      expect(newestRendered(g)).toBe(ordinal)
    })
  }
})

test.describe('editing', () => {
  const editBar = (page: Page) => page.getByTestId(T.CHAT_EDIT_CANCEL)

  // an edit left open (a failed assertion) must not carry into the next test
  test.afterEach(async ({page}) => {
    if (await editBar(page).count()) {
      await composer.press(page, 'Escape')
    }
    await expect(editBar(page)).toHaveCount(0, {timeout: 5_000})
    await expect.poll(async () => composer.getText(page), {timeout: 5_000}).toBe('')
  })

  const expectRowWhollyInView = async (page: Page, ordinal: number) => {
    const rect = await ordinalRect(page, ordinal)
    expect(rect, `row ${ordinal} rendered`).toBeDefined()
    expect(rect!.top, `row ${ordinal} top`).toBeGreaterThanOrEqual(-1)
    expect(rect!.bottom, `row ${ordinal} bottom against the view's ${rect!.viewHeight}`).toBeLessThanOrEqual(rect!.viewHeight + 1)
  }

  test('editing a message in view does not scroll the thread', async ({page}) => {
    await openFresh(page, E2E_CHANNELS.scratch)
    const text = `e2e-scroll-edit-visible-${Date.now()}`
    const ordinal = await sendMessage(page, text)
    await expectAtEnd(page)

    await composer.press(page, 'ArrowUp')
    await expect(editBar(page)).toBeVisible({timeout: 5_000})
    await expect.poll(async () => composer.getText(page), {timeout: 5_000}).toBe(text)
    // the composer grows for the edit bar; the list keeps its end and the row stays in view
    await expectAtEnd(page)
    await expectRowWhollyInView(page, ordinal)
  })

  test('editing a message scrolled out of view brings it into view', async ({page}) => {
    await openFresh(page, E2E_CHANNELS.scratch)
    const text = `e2e-scroll-edit-offscreen-${Date.now()}`
    const ordinal = await sendMessage(page, text)
    await expectAtEnd(page)
    await wheelThread(page, -1_500)
    await waitForScrollStable(page)
    expect(await ordinalRect(page, ordinal), 'the message is out of view').toBeUndefined()

    await composer.press(page, 'ArrowUp')
    await expect(editBar(page)).toBeVisible({timeout: 5_000})
    await expect(rowByOrdinal(page, ordinal)).toHaveCount(1, {timeout: 5_000})
    await waitForScrollStable(page)
    await expectRowWhollyInView(page, ordinal)
  })
})

test('mark unread shows the catch-up pill, which centres the unread line', async ({page}) => {
  await openFresh(page, E2E_CHANNELS.long)
  await expectAtEnd(page)
  await wheelThread(page, -1_500)
  const up = await waitForScrollStable(page)
  const target = pickAnchor(up, 100)
  try {
    const menu = await messageMenu(page, target.ordinal)
    await clickUnoccluded(menu.getByText('Mark as unread', {exact: true}))
    await expect(page.getByTestId(T.FLOATING_MENU)).toHaveCount(0, {timeout: 5_000})
    // the unread line is in view: no pill yet
    await waitForScrollStable(page)
    await expect(catchUp(page)).toHaveCount(0)

    await wheelThread(page, 5_000)
    await expectAtEnd(page)
    await expect(catchUp(page)).toBeVisible({timeout: 5_000})

    await clickUnoccluded(catchUp(page))
    await expectCentred(page, target.ordinal)
    await expect(catchUp(page)).toHaveCount(0, {timeout: 5_000})
  } finally {
    // a fresh open marks the thread read again
    await openFresh(page, E2E_CHANNELS.long)
  }
})

test('returning to the chat tab keeps the reader in place', async ({page}) => {
  await openFresh(page, E2E_CHANNELS.long)
  await expectAtEnd(page)
  await wheelThread(page, -700)
  const before = await waitForScrollStable(page)
  const anchor = pickAnchor(before, 40)

  await page.getByTestId(T.NAV_TAB_PEOPLE).click({force: true, timeout: 5_000})
  await expect(page.getByTestId(T.CHAT_MESSAGE_LIST)).toBeHidden({timeout: 5_000})
  await page.getByTestId(T.NAV_TAB_CHAT).click({force: true, timeout: 5_000})
  await expect(rowByOrdinal(page, anchor.ordinal)).toBeVisible({timeout: 5_000})

  const after = await waitForScrollStable(page)
  expect(Math.abs((rowTop(after, anchor.ordinal) ?? Infinity) - anchor.top)).toBeLessThanOrEqual(2)
})
