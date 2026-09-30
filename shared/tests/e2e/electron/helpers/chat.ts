// Chat helpers for the desktop flows: open a conversation by name, drive the composer and thread
// search, and read the thread's geometry straight from the DOM (the scroller and its
// [data-ordinal] rows). Everything here observes the page; nothing reaches into app state.
import {expect, type ConsoleMessage, type Locator, type Page} from '@playwright/test'
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

// -- moving the thread as a reader ---------------------------------------------------------------

// A mouse wheel over the middle of the thread; positive dy scrolls toward the newest message.
export const wheelThread = async (page: Page, dy: number) => {
  const box = await page.getByTestId(T.CHAT_MESSAGE_LIST).boundingBox({timeout: 5_000})
  if (!box) throw new Error('no thread list on the page')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.wheel(0, dy)
}

// The thread's scroller as the scrollbar sees it, in page coordinates.
const scrollerMetrics = async (page: Page) =>
  page.evaluate(testID => {
    const g = globalThis as unknown as PageGlobals
    const wrapper = g.document.querySelector(`[data-testid="${testID}"]`)
    const scroller = wrapper && Array.from(wrapper.children).find(c => /auto|scroll/.test(g.getComputedStyle(c).overflowY))
    if (!scroller) throw new Error('no thread list on the page')
    const r = scroller.getBoundingClientRect()
    return {
      clientHeight: scroller.clientHeight,
      left: r.left,
      scrollHeight: scroller.scrollHeight,
      scrollTop: scroller.scrollTop,
      top: r.top,
      width: r.width,
    }
  }, T.CHAT_MESSAGE_LIST)

// Drags the scrollbar thumb by dy pixels (positive: toward the newest message). macOS draws overlay
// scrollbars, shown only while the scroller moves and kept while the pointer is over them, so
// callers either drag right after the list scrolled (a centring's own scroll shows it) or pass
// nudge: a small wheel with the pointer already on the thumb shows it there first.
export const dragScrollbar = async (page: Page, dy: number, opts: {nudge?: boolean} = {}) => {
  const thumbAt = (m: Awaited<ReturnType<typeof scrollerMetrics>>) => {
    const thumbHeight = Math.max(20, (m.clientHeight * m.clientHeight) / m.scrollHeight)
    return {x: m.left + m.width - 5, y: m.top + (m.scrollTop / m.scrollHeight) * m.clientHeight + thumbHeight / 2}
  }
  let m = await scrollerMetrics(page)
  if (opts.nudge) {
    const at = thumbAt(m)
    await page.mouse.move(at.x, at.y)
    await page.mouse.wheel(0, -10)
    const before = m.scrollTop
    await expect.poll(async () => (await scrollerMetrics(page)).scrollTop, {timeout: 2_000}).not.toBe(before)
    m = await scrollerMetrics(page)
  }
  const {x, y} = thumbAt(m)
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, y + dy, {steps: 10})
  await page.mouse.up()
}

// Puts keyboard focus on the thread's scroller, where a reader tabbing to it would put it, so the
// browser's own scrolling keys (End, Home, Page Up/Down, arrows) move it.
export const focusThreadScroller = async (page: Page) => {
  const focused = await page.evaluate(testID => {
    type Focusable = {focus: () => void}
    const g = globalThis as unknown as PageGlobals & {document: {activeElement: unknown}}
    const wrapper = g.document.querySelector(`[data-testid="${testID}"]`)
    const scroller = wrapper && Array.from(wrapper.children).find(c => /auto|scroll/.test(g.getComputedStyle(c).overflowY))
    if (!scroller) return false
    ;(scroller as unknown as Focusable).focus()
    return g.document.activeElement === scroller
  }, T.CHAT_MESSAGE_LIST)
  if (!focused) throw new Error('the thread scroller did not take focus')
}

// -- clicking ------------------------------------------------------------------------------------

// Clicks the locator's centre only once that point hits the element itself (or a child): isVisible
// does not check occlusion, and a click on a covered element lands on whatever covers it.
export const clickUnoccluded = async (locator: Locator, timeoutMs = 5_000) => {
  const page = locator.page()
  const deadline = Date.now() + timeoutMs
  let coveredBy = ''
  for (;;) {
    const box = await locator.boundingBox({timeout: timeoutMs})
    if (box) {
      const x = box.x + box.width / 2
      const y = box.y + box.height / 2
      const hit = await locator.evaluate(
        (el, [px, py]) => {
          const target = el as unknown as ElLike
          const top = (globalThis as unknown as PageGlobals).document.elementFromPoint(px, py)
          const owns = !!top && (top === target || target.contains(top))
          return {coveredBy: owns ? '' : ((top as unknown as {outerHTML?: string} | null)?.outerHTML ?? 'nothing').slice(0, 200), owns}
        },
        [x, y] as const,
        {timeout: timeoutMs}
      )
      if (hit.owns) {
        await page.mouse.click(x, y)
        return
      }
      coveredBy = hit.coveredBy
    }
    if (Date.now() > deadline) throw new Error(`${String(locator)} is covered at its centre by ${coveredBy}`)
    await page.waitForTimeout(100)
  }
}

// -- conversations -------------------------------------------------------------------------------

export const threadHeaderTitle = (page: Page) => page.getByTestId(T.CHAT_HEADER_TITLE)

// Picks a result in the inbox search (mod+k) and waits for its thread. `pick` finds the result's
// row among everything the search shows.
const openFromInboxSearch = async (page: Page, query: string, pick: (page: Page) => Locator) => {
  await navigateToChat(page)
  await page.keyboard.press('Meta+k')
  const search = page.getByPlaceholder('Search', {exact: true})
  await expect(search).toBeFocused({timeout: 5_000})
  await search.fill(query)
  const row = pick(page).first()
  await expect(row).toBeVisible({timeout: 10_000})
  await clickUnoccluded(row)
  await expect(page.getByTestId(T.CHAT_MESSAGE_LIST)).toBeVisible({timeout: 10_000})
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// A conversation result names its conversation in semibold; a user result above the conversations
// (which opens the profile) shows the same name in another style.
const conversationResult = (name: string) => (page: Page) =>
  page.locator('.text_BodySemibold').filter({hasText: new RegExp(`^${escapeRegExp(name)}$`)})

// Opens a team channel by name, and checks the header names it.
export const openConversationByName = async (page: Page, team: string, channel: string) => {
  await openFromInboxSearch(page, channel, p => p.getByText(`#${channel}`, {exact: true}))
  await expect(threadHeaderTitle(page)).toHaveText(`${team}#${channel}`, {timeout: 10_000})
}

// Opens the user's conversation with themselves. Its header shows the user's full name when they
// have one, so the composer's hint is what names it.
export const openSelfConversation = async (page: Page, username: string) => {
  await openFromInboxSearch(page, username, conversationResult(username))
  await expect(composerInput(page)).toHaveAttribute('placeholder', 'Message yourself', {timeout: 10_000})
}

// Opens the signed-in user's one-on-one conversation with `username`.
export const openDirectConversation = async (page: Page, username: string) => {
  await openFromInboxSearch(page, username, conversationResult(username))
  await expect(threadHeaderTitle(page)).toHaveText(username, {timeout: 10_000})
}

// A small conversation's inbox row, by the participant names its title carries (the user's own
// name for their conversation with themselves).
export const inboxRow = (page: Page, title: string) =>
  page.getByTestId(T.CHAT_INBOX_ROW).filter({has: page.locator(`[title="${title}"]`)})

// The inbox rows drawn as selected, by name: a big team's channel as `#channel` (its name turns
// semibold), a small conversation by its row's title. One entry while one conversation is selected.
export const selectedInboxRows = async (page: Page) =>
  page.evaluate(() => {
    type El = {getAttribute: (n: string) => string | null; textContent: string | null}
    const g = globalThis as unknown as {document: {querySelectorAll: (s: string) => ArrayLike<El>}}
    const inbox = '.inbox-hover-container'
    const channels = Array.from(
      g.document.querySelectorAll(`${inbox} .hover_background_color_blueGreyDark > .text_Body > .text_BodySemibold`)
    ).map(
      el => `#${(el.textContent ?? '').trim()}`
    )
    const small = Array.from(g.document.querySelectorAll(`${inbox} .small-row.selected [title]`)).map(
      el => el.getAttribute('title') ?? ''
    )
    return [...channels, ...small]
  })

// Reads the thread header and the selected inbox rows every 100ms for `forMs`, and returns each
// distinct reading in order, so a selection that moves and comes back still shows the move.
export const watchSelection = async (page: Page, forMs: number) => {
  const seen: Array<string> = []
  const start = Date.now()
  while (Date.now() - start < forMs) {
    const header = (await threadHeaderTitle(page).count()) ? await threadHeaderTitle(page).innerText({timeout: 1_000}) : ''
    const reading = `${header} | ${(await selectedInboxRows(page)).join(', ')}`
    if (seen.at(-1) !== reading) seen.push(reading)
    await page.waitForTimeout(100)
  }
  return seen
}

// Collects the renderer's console errors from now until stop(), less those matching `ignore`.
export const collectConsoleErrors = (page: Page, ignore: ReadonlyArray<RegExp> = []) => {
  const errors: Array<string> = []
  const onConsole = (m: ConsoleMessage) => {
    if (m.type() === 'error') errors.push(m.text())
  }
  page.on('console', onConsole)
  return {
    stop: () => {
      page.off('console', onConsole)
      return errors.filter(e => !ignore.some(r => r.test(e)))
    },
  }
}

// -- accounts ------------------------------------------------------------------------------------

// The signed-in user's name in the tab bar: "Hi <name>!", or the bare name when that is too long.
const signedInName = (page: Page) => page.locator('.username').first()
export const signedInAs = async (page: Page) =>
  (await signedInName(page).innerText({timeout: 5_000})).replace(/^Hi /, '').replace(/!$/, '').trim()

// Switches the app to another account signed in on this device, through the account switcher in
// the tab bar's user menu, waits for the tab bar to name it, and opens the chat tab (the switch
// lands on the People tab). A conversation the caller opens next stays open, even while the chat
// tab is still picking one for the account.
export const switchAccount = async (page: Page, username: string) => {
  if ((await signedInAs(page)) === username) return
  await signedInName(page).click({force: true, timeout: 5_000})
  const row = page.locator('.accountSwitcherScrollView').getByText(username, {exact: true})
  await expect(row).toBeVisible({timeout: 5_000})
  // the switcher's popup ignores a choice within 100ms of showing (see messageMenu)
  await page.waitForTimeout(150)
  await clickUnoccluded(row)
  await expect(signedInName(page)).toHaveText(new RegExp(`^(Hi )?${escapeRegExp(username)}!?$`), {timeout: 30_000})
  await navigateToChat(page)
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
  const ellipsis = row.locator('.icon-gen-iconfont-ellipsis').first()
  const menu = page.getByTestId(T.FLOATING_MENU)
  // The row shows its "..." only while hovered, and the list ignores the pointer until 200ms after
  // its last scroll: hover again until the row takes it. A row that moves between the hover and the
  // click (the list settling after a send) loses the hover and hides its "...", so the click is
  // retried along with the hover.
  await expect(async () => {
    if (await menu.isVisible()) return
    await row.hover({timeout: 1_000})
    await expect(ellipsis).toBeVisible({timeout: 500})
    await clickUnoccluded(ellipsis, 1_000)
    await expect(menu).toBeVisible({timeout: 1_000})
  }).toPass({timeout: 10_000})
  // The popup ignores a hide within 100ms of its show (usePopup2's tooQuick guard against a
  // double toggle), and choosing an item hides it through that path: an item chosen sooner runs
  // but leaves the menu open.
  await page.waitForTimeout(150)
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

export type SuggestionRow = {selected: boolean; text: string}

// The open suggestion list's rows top to bottom, each with its text and whether it is the
// highlighted one. Empty while no list is open.
export const suggestionRows = async (page: Page): Promise<Array<SuggestionRow>> =>
  page.evaluate(
    ([listID, rowID, selectedID]) => {
      type RowEl = ElLike & {innerText: string}
      const g = globalThis as unknown as PageGlobals
      const list = g.document.querySelector(`[data-testid="${listID}"]`)
      if (!list) return []
      const rows = Array.from(list.querySelectorAll(`[data-testid="${rowID}"], [data-testid="${selectedID}"]`)) as Array<RowEl>
      return rows
        .map(el => ({selected: el.getAttribute('data-testid') === selectedID, text: el.innerText, top: el.getBoundingClientRect().top}))
        .sort((a, b) => a.top - b.top)
        .map(({selected, text}) => ({selected, text}))
    },
    [T.CHAT_SUGGESTION_LIST, T.CHAT_SUGGESTION_ROW, T.CHAT_SUGGESTION_ROW_SELECTED] as const
  )

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

// -- standing in for the service, and reading what the app asked of it ---------------------------
// A few flows need a notification the service only sends in conditions a test cannot arrange on
// demand (a thread gone stale while a delete waits to go out), or need to know what the app decided
// and asked for. These reach the app's own modules through the dev server's module graph: a dynamic
// import of a module's path returns the instance the app runs, so they add nothing to the app.
type RouterModule = {routeChatNotification: (action: unknown) => void}
type ChatTypesModule = {keyToConversationID: (key: string) => unknown}
type Store<S> = {getState: () => S; subscribe: (f: (s: S, prev: S) => void) => () => void}
type StaleGlobals = {__e2eStale?: {count: number; timer: ReturnType<typeof setInterval>}}

// Starts handing the app a ChatThreadsStale for the conversation every `everyMs`, as the service
// sends one when a thread changed underneath it; each makes the open thread reload. With
// `clickFirst`, the first one follows a click on that element in the same task, so its reload is
// asked for right behind whatever the click asks of the service.
export const startStaleReloads = async (page: Page, convID: string, everyMs = 100, clickFirst?: Locator) => {
  const target = clickFirst ? await clickFirst.elementHandle({timeout: 5_000}) : null
  return page.evaluate(
    async ([id, ms, el]) => {
      const router = (await import('/chat/notification-router.tsx' as string)) as RouterModule
      const types = (await import('/constants/types/chat/index.tsx' as string)) as ChatTypesModule
      const g = globalThis as unknown as StaleGlobals
      if (g.__e2eStale) clearInterval(g.__e2eStale.timer)
      const state = {count: 0, timer: setInterval(() => {}, 1 << 30)}
      clearInterval(state.timer)
      const fire = () => {
        state.count++
        // updateType 1: newactivity
        router.routeChatNotification({
          payload: {params: {updates: [{convID: types.keyToConversationID(id), updateType: 1}]}},
          type: 'chat.1.NotifyChat.ChatThreadsStale',
        })
      }
      ;(el as unknown as {click: () => void} | null)?.click()
      fire()
      state.timer = setInterval(fire, ms)
      g.__e2eStale = state
    },
    [convID, everyMs, target] as const
  )
}

// Stops the reloads startStaleReloads started, and returns how many it handed the app.
export const stopStaleReloads = async (page: Page) =>
  page.evaluate(() => {
    const g = globalThis as unknown as StaleGlobals
    if (!g.__e2eStale) return 0
    clearInterval(g.__e2eStale.timer)
    const {count} = g.__e2eStale
    g.__e2eStale = undefined
    return count
  })

export type ReselectSeen = {
  // the conversation the layout's reselect info named
  named: string
  // the watched conversation was the selection when the layout came
  whileSelected: boolean
  // what the app knew of the watched conversation then: an inbox row, and its meta's trust
  inboxRow: boolean
  meta: 'none' | 'error' | 'ok'
}
type ReselectGlobals = {__e2eReselects?: {seen: Array<ReselectSeen>; stop: () => void}}

// Records every inbox layout that carries reselect info, which conversation it names, and what the
// app knew of the watched conversation at that moment. The service adds that info to a layout
// while the conversation it last loaded is not in the inbox; a split layout moves a selection it
// names that is gone from the account.
export const watchReselects = async (page: Page, convID: string) =>
  page.evaluate(async id => {
    type Layout = {reselectInfo?: {oldConvID?: string}}
    type LayoutState = {layout?: Layout}
    const layoutMod = (await import('/chat/inbox/layout-state.tsx' as string)) as {
      getBigLayoutChannelRow: (s: LayoutState, id: string) => unknown
      getSmallLayoutRow: (s: LayoutState, id: string) => unknown
      useInboxLayoutState: Store<LayoutState>
    }
    const metaMod = (await import('/chat/inbox/metadata-store.tsx' as string)) as {
      useInboxMetadataState: Store<{metas: Map<string, {trustedState: string}>}>
    }
    const common = (await import('/constants/chat/common.tsx' as string)) as {getSelectedConversation: () => string}
    const g = globalThis as unknown as ReselectGlobals
    g.__e2eReselects?.stop()
    const seen: Array<ReselectSeen> = []
    const stop = layoutMod.useInboxLayoutState.subscribe((s, prev) => {
      if (s.layout === prev.layout || !s.layout?.reselectInfo) return
      const meta = metaMod.useInboxMetadataState.getState().metas.get(id)
      seen.push({
        inboxRow: !!(layoutMod.getSmallLayoutRow(s, id) || layoutMod.getBigLayoutChannelRow(s, id)),
        meta: !meta ? 'none' : meta.trustedState === 'error' ? 'error' : 'ok',
        named: s.layout.reselectInfo.oldConvID ?? '',
        whileSelected: common.getSelectedConversation() === id,
      })
    })
    g.__e2eReselects = {seen, stop}
  }, convID)

export const stopWatchingReselects = async (page: Page) =>
  page.evaluate(() => {
    const g = globalThis as unknown as ReselectGlobals
    const r = g.__e2eReselects
    g.__e2eReselects = undefined
    r?.stop()
    return r?.seen ?? []
  })

// The waiting keys the app holds right now (a spinner or a disabled control waits on each).
export const heldWaitingKeys = async (page: Page) =>
  page.evaluate(async () => {
    const mod = (await import('/stores/waiting.tsx' as string)) as {useWaitingState: Store<{counts: Map<string, number>}>}
    return [...mod.useWaitingState.getState().counts].filter(([, n]) => n > 0).map(([k]) => k)
  })

export type OutgoingRpc = {afterAccountChange: boolean; method: string; params: string}
const uidChangedMarker = 'e2e-signed-in-account-changed'

// Records every RPC the app sends from now until stop(), read off the dev build's RPC log in the
// renderer console, each marked with whether the signed-in account had changed by then.
export const watchOutgoingRpcs = async (page: Page) => {
  const calls: Array<OutgoingRpc> = []
  let changed = false
  const onConsole = (m: ConsoleMessage) => {
    const text = m.text()
    if (text.includes(uidChangedMarker)) {
      changed = true
      return
    }
    const call = /<< OUT\s.*?\s((?:chat|keybase)\.1\.[\w.]+)\s.*?\[\+calling\] \S+ (\{.*)$/.exec(text.replace(/%[cs]/g, ' '))
    if (call) calls.push({afterAccountChange: changed, method: call[1]!, params: call[2]!})
  }
  page.on('console', onConsole)
  await page.evaluate(
    async marker => {
      const mod = (await import('/stores/current-user.tsx' as string)) as {useCurrentUserState: Store<{uid: string}>}
      const g = globalThis as unknown as {__e2eUidWatch?: () => void}
      g.__e2eUidWatch?.()
      g.__e2eUidWatch = mod.useCurrentUserState.subscribe((s, prev) => {
        if (s.uid !== prev.uid) console.log(marker)
      })
    },
    uidChangedMarker
  )
  return {
    stop: async () => {
      page.off('console', onConsole)
      await page.evaluate(() => {
        const g = globalThis as unknown as {__e2eUidWatch?: () => void}
        g.__e2eUidWatch?.()
        g.__e2eUidWatch = undefined
      })
      return calls
    },
  }
}

// Switches accounts through the app's own switch (what the account switcher's row calls), for a
// flow that must keep typing in the composer while the switch runs, which the switcher's menu
// would take the focus from.
export const startAccountSwitch = async (page: Page, username: string) => {
  const started = await page.evaluate(async u => {
    const mod = (await import('/stores/config.tsx' as string)) as {
      useConfigState: {getState: () => {dispatch: {switchToAccount: (u: string) => unknown}}}
    }
    return !!mod.useConfigState.getState().dispatch.switchToAccount(u)
  }, username)
  if (!started) throw new Error(`the app would not switch to ${username}`)
}

// The conversation the app has selected, every 100ms for `forMs`: each distinct one in order.
export const watchSelectedConversation = async (page: Page, forMs: number) =>
  page.evaluate(async ms => {
    const common = (await import('/constants/chat/common.tsx' as string)) as {getSelectedConversation: () => string}
    const seen: Array<string> = []
    for (const until = Date.now() + ms; Date.now() < until; ) {
      const now = common.getSelectedConversation()
      if (seen.at(-1) !== now) seen.push(now)
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    return seen
  }, forMs)
