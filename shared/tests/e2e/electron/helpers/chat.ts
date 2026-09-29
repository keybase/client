// Chat helpers for the desktop flows: open a conversation by name, drive the composer and thread
// search, and read the thread's geometry straight from the DOM (the scroller and its
// [data-ordinal] rows). Everything here observes the page; nothing reaches into app state.
import {expect, type Locator, type Page} from '@playwright/test'
import * as T from '@/tests/e2e/shared/test-ids'
import {navigateToChat} from './navigate'

// The same tolerance the thread itself treats as at the end (list-area's endTolerancePx).
export const endTolerancePx = 2

// -- DOM shapes ------------------------------------------------------------------------------------
// The shared tsconfig has no DOM lib for react-native, so page-side code describes only the nodes
// it touches.
type RectLike = {bottom: number; height: number; left: number; top: number; width: number}
type ElLike = {
  children: ArrayLike<ElLike>
  clientHeight: number
  contains: (other: ElLike | null) => boolean
  getAttribute: (name: string) => string | null
  getBoundingClientRect: () => RectLike
  querySelector: (selector: string) => ElLike | null
  querySelectorAll: (selector: string) => ArrayLike<ElLike>
  scrollHeight: number
  scrollTop: number
  selectionEnd?: number | null
  selectionStart?: number | null
}
type PageGlobals = {
  document: {elementFromPoint: (x: number, y: number) => ElLike | null; querySelector: (s: string) => ElLike | null}
  getComputedStyle: (el: ElLike) => {overflowY: string}
}

export type ThreadGeometry = {
  clientHeight: number
  distanceFromEnd: number
  // [data-ordinal] rows in the DOM, in ordinal order, positioned relative to the viewport top
  rows: Array<{bottom: number; ordinal: number; top: number}>
  scrollHeight: number
  scrollTop: number
  viewHeight: number
}

// One reading of the thread list: the scroller (the list's own overflow child of the
// chat-message-list wrapper, not the wrapper, whose padding reaches below the view) and its rows.
export const readThreadGeometry = async (page: Page): Promise<ThreadGeometry | undefined> =>
  page.evaluate(testID => {
    const g = globalThis as unknown as PageGlobals
    const wrapper = g.document.querySelector(`[data-testid="${testID}"]`)
    if (!wrapper) return undefined
    const scroller = Array.from(wrapper.children).find(c => /auto|scroll/.test(g.getComputedStyle(c).overflowY))
    if (!scroller) return undefined
    const view = scroller.getBoundingClientRect()
    const rows = Array.from(scroller.querySelectorAll('[data-ordinal]'))
      .map(el => {
        const r = el.getBoundingClientRect()
        return {bottom: r.bottom - view.top, ordinal: Number(el.getAttribute('data-ordinal')), top: r.top - view.top}
      })
      .sort((a, b) => a.ordinal - b.ordinal)
    return {
      clientHeight: scroller.clientHeight,
      distanceFromEnd: scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop,
      rows,
      scrollHeight: scroller.scrollHeight,
      scrollTop: scroller.scrollTop,
      viewHeight: view.height,
    }
  }, T.CHAT_MESSAGE_LIST)

const requireGeometry = async (page: Page) => {
  const g = await readThreadGeometry(page)
  if (!g) throw new Error('no thread list on the page')
  return g
}

export const distanceFromEnd = async (page: Page) => (await requireGeometry(page)).distanceFromEnd

// The row's box relative to the viewport's top; undefined while the row is not rendered.
export const ordinalRect = async (page: Page, ordinal: number) => {
  const g = await requireGeometry(page)
  const row = g.rows.find(r => r.ordinal === ordinal)
  return row && {bottom: row.bottom, height: row.bottom - row.top, top: row.top, viewHeight: g.viewHeight}
}

// How far the row's middle sits from the viewport's middle (positive: below it), and whether that
// is within tolerance. A row not rendered is not centred.
export const isOrdinalCentred = async (page: Page, ordinal: number, tolerancePx = 16) => {
  const rect = await ordinalRect(page, ordinal)
  if (!rect) return {centred: false, offset: undefined}
  const offset = rect.top + rect.height / 2 - rect.viewHeight / 2
  return {centred: Math.abs(offset) <= tolerancePx, offset}
}

// The rows the list has in the DOM (it virtualizes, so this is a window, not the whole thread).
export const loadedOrdinalRange = async (page: Page) => {
  const {rows} = await requireGeometry(page)
  const first = rows[0]
  const last = rows.at(-1)
  return first && last ? {count: rows.length, max: last.ordinal, min: first.ordinal} : undefined
}

const sameReading = (a: ThreadGeometry, b: ThreadGeometry) =>
  a.scrollTop === b.scrollTop && a.scrollHeight === b.scrollHeight && a.clientHeight === b.clientHeight

// Waits until two readings 250ms apart agree (scroll offset and content size), and returns the
// second. Throws if the list is still moving when the timeout runs out.
export const waitForScrollStable = async (page: Page, timeoutMs = 10_000) => {
  const deadline = Date.now() + timeoutMs
  let last: ThreadGeometry | undefined
  for (;;) {
    const first = await readThreadGeometry(page)
    await page.waitForTimeout(250)
    const second = await readThreadGeometry(page)
    if (first && second && sameReading(first, second)) return second
    last = second
    if (Date.now() > deadline) {
      throw new Error(`thread list did not settle within ${timeoutMs}ms (last: ${JSON.stringify(last && {...last, rows: last.rows.length})})`)
    }
  }
}

// -- clicking ------------------------------------------------------------------------------------

// Clicks the locator's centre only once that point hits the element itself (or a child): isVisible
// does not check occlusion, and a click on a covered element lands on whatever covers it.
export const clickUnoccluded = async (locator: Locator, timeoutMs = 5_000) => {
  const page = locator.page()
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const box = await locator.boundingBox({timeout: timeoutMs})
    if (box) {
      const x = box.x + box.width / 2
      const y = box.y + box.height / 2
      const owns = await locator.evaluate(
        (el, [px, py]) => {
          const target = el as unknown as ElLike
          const top = (globalThis as unknown as PageGlobals).document.elementFromPoint(px, py)
          return !!top && (top === target || target.contains(top))
        },
        [x, y] as const,
        {timeout: timeoutMs}
      )
      if (owns) {
        await page.mouse.click(x, y)
        return
      }
    }
    if (Date.now() > deadline) throw new Error(`${String(locator)} is covered at its centre`)
    await page.waitForTimeout(100)
  }
}

// -- conversations -------------------------------------------------------------------------------

export const threadHeaderTitle = (page: Page) => page.getByTestId(T.CHAT_HEADER_TITLE)

// Picks a result in the inbox search (mod+k) by its exact row text and waits for its thread.
const openFromInboxSearch = async (page: Page, query: string, rowText: string) => {
  await navigateToChat(page)
  await page.keyboard.press('Meta+k')
  const search = page.getByPlaceholder('Search', {exact: true})
  await expect(search).toBeFocused({timeout: 5_000})
  await search.fill(query)
  const row = page.getByText(rowText, {exact: true}).first()
  await expect(row).toBeVisible({timeout: 10_000})
  await clickUnoccluded(row)
  await expect(page.getByTestId(T.CHAT_MESSAGE_LIST)).toBeVisible({timeout: 10_000})
}

// Opens a team channel by name, and checks the header names it.
export const openConversationByName = async (page: Page, team: string, channel: string) => {
  await openFromInboxSearch(page, channel, `#${channel}`)
  await expect(threadHeaderTitle(page)).toHaveText(`${team}#${channel}`, {timeout: 10_000})
}

// Opens the user's conversation with themselves. Its header shows the user's full name when they
// have one, so the composer's hint is what names it.
export const openSelfConversation = async (page: Page, username: string) => {
  await openFromInboxSearch(page, username, username)
  await expect(composerInput(page)).toHaveAttribute('placeholder', 'Message yourself', {timeout: 10_000})
}

// -- rows ----------------------------------------------------------------------------------------

export const rowByOrdinal = (page: Page, ordinal: number) =>
  page.getByTestId(T.CHAT_MESSAGE_LIST).locator(`[data-ordinal="${ordinal}"]`)

// Waits for the row carrying `marker` to be in the DOM and returns its ordinal.
export const waitForRow = async (page: Page, marker: string, timeoutMs = 10_000) => {
  const row = page.getByTestId(T.CHAT_MESSAGE_LIST).locator('[data-ordinal]').filter({hasText: marker})
  await expect(row).toHaveCount(1, {timeout: timeoutMs})
  return Number(await row.getAttribute('data-ordinal', {timeout: timeoutMs}))
}

// Opens a message's "..." menu and returns the menu.
export const messageMenu = async (page: Page, ordinal: number) => {
  const row = rowByOrdinal(page, ordinal)
  await row.hover({timeout: 5_000})
  await clickUnoccluded(row.locator('.icon-gen-iconfont-ellipsis').first())
  const menu = page.getByTestId(T.FLOATING_MENU)
  await expect(menu).toBeVisible({timeout: 5_000})
  return menu
}

// Closes the open floating menu with Escape. The menu's Escape handler registers a render after the
// menu shows, so an Escape pressed in that gap is dropped: press again until it closes.
export const closeMenu = async (page: Page) => {
  const menu = page.getByTestId(T.FLOATING_MENU)
  await expect(async () => {
    await page.keyboard.press('Escape')
    await expect(menu).toHaveCount(0, {timeout: 500})
  }).toPass({timeout: 5_000})
}

// -- composer ------------------------------------------------------------------------------------

export const composerInput = (page: Page) => page.getByTestId(T.CHAT_INPUT)

export const composer = {
  // where the caret is (start === end when nothing is selected)
  caret: async (page: Page) =>
    composerInput(page).evaluate(el => {
      const input = el as unknown as ElLike
      return {end: input.selectionEnd ?? 0, start: input.selectionStart ?? 0}
    }),
  focus: async (page: Page) => {
    await composerInput(page).click({timeout: 5_000})
  },
  getText: async (page: Page) => composerInput(page).inputValue({timeout: 5_000}),
  press: async (page: Page, key: string) => {
    await composerInput(page).press(key, {timeout: 5_000})
  },
  // types key by key into the focused composer, as a user would
  type: async (page: Page, text: string) => {
    await composerInput(page).click({timeout: 5_000})
    await page.keyboard.type(text)
  },
}

// Sends `text` from the composer and returns the ordinal of the row that shows it.
export const sendMessage = async (page: Page, text: string) => {
  const input = composerInput(page)
  await input.click({timeout: 5_000})
  await input.fill(text, {timeout: 5_000})
  await input.press('Enter', {timeout: 5_000})
  return waitForRow(page, text)
}

// -- thread search -------------------------------------------------------------------------------

export const threadSearch = (page: Page) => page.getByTestId(T.CHAT_THREAD_SEARCH)

export const openThreadSearch = async (page: Page) => {
  if (await threadSearch(page).isVisible()) return
  // the header sits in the window's drag region, so its controls need a forced click
  await page.getByTestId(T.CHAT_HEADER_SEARCH_BUTTON).click({force: true, timeout: 5_000})
  await expect(threadSearch(page)).toBeVisible({timeout: 5_000})
}

// Runs a search and waits for it to finish; returns the hits' texts, newest first.
export const searchFor = async (page: Page, query: string, timeoutMs = 15_000) => {
  const input = threadSearch(page).getByTestId(T.CHAT_THREAD_SEARCH_INPUT).locator('input')
  await input.fill(query, {timeout: 5_000})
  await input.press('Enter', {timeout: 5_000})
  const hits = threadSearch(page).getByTestId(T.CHAT_THREAD_SEARCH_HIT)
  const counter = threadSearch(page).getByText(/^(No results|\d+ of \d+)$/)
  await expect(counter).toBeVisible({timeout: timeoutMs})
  // the counter shows as soon as the first hit lands; let the rest arrive
  await expect
    .poll(async () => {
      const a = await hits.count()
      await page.waitForTimeout(300)
      return a === (await hits.count()) ? a : -1
    }, {timeout: timeoutMs})
    .toBeGreaterThanOrEqual(0)
  return hits.allInnerTexts()
}

export const selectHit = async (page: Page, index: number) => {
  await clickUnoccluded(threadSearch(page).getByTestId(T.CHAT_THREAD_SEARCH_HIT).nth(index))
}

export const closeSearch = async (page: Page) => {
  await threadSearch(page).getByText('Cancel', {exact: true}).click({timeout: 5_000})
  await expect(threadSearch(page)).toHaveCount(0, {timeout: 5_000})
}
