// Chat helpers for the iOS flows: open a seeded conversation, drive the composer, thread search and
// a message's menu, and read the thread as the list holds it.
//
// Geometry comes from the running app through Metro (jsEval), read off the React tree the way React
// DevTools reads it: the thread's FlatList (its scroll offset, its viewport's window rect, and the
// offset and height it measured for each row), the conversation's centre, and its thread store.
// Nothing in the app is added for the tests to read. Positions are window points, the same space as
// Appium's element rects, so they compare with the composer's and the keyboard's.
import {byText, el, waitForTestID} from './elements'
import {appSnapshot, jsEval as jsEvalOnce, openUrl, waitFor} from './lifecycle'
import {atTabs, escapeToTabs, navigateToChat} from './navigate'
import * as T from '../../shared/test-ids'

const sleep = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Metro's inspector connection to the app drops now and then for a moment (the app keeps running);
// an eval that fails to connect is tried again for a few seconds before it counts.
const jsEval = async <R>(body: string): Promise<R> => {
  const end = Date.now() + 10_000
  for (;;) {
    try {
      return await jsEvalOnce<R>(body)
    } catch (e) {
      const transient = e instanceof Error && /no Metro inspector page|inspector connection failed|inspector evaluate timed out/.test(e.message)
      if (!transient || Date.now() > end) throw e
      await sleep(500)
    }
  }
}

// -- reading the thread ---------------------------------------------------------------------------

export type ThreadRow = {bottom: number; ordinal: number; top: number}

export type ThreadReading = {
  // the conversation the list shows
  convID: string
  centeredOrdinal?: number
  // the rows the list has loaded, oldest first
  ordinals: Array<number>
  // the rows the list has rendered and measured, oldest first, in window points
  rows: Array<ThreadRow>
  // the list's scroll offset: 0 at its newest end with no keyboard, negative with one up
  offset: number
  // the list's viewport in window points (it runs under the composer)
  listTop: number
  listBottom: number
  moreToLoadBack: boolean
  moreToLoadForward: boolean
  // the keyboard's top in window points, when one is up
  keyboardTop?: number
}

// In-app functions the thread readers share. They reach React's fiber tree (as React DevTools does)
// and VirtualizedList's private fields, neither of which is an API: each lookup checks what it
// relies on and throws naming it, so a React Native upgrade or an app refactor that moves them fails
// here, clearly, rather than reading undefined.
//
// e2eThreadList(convID): the thread FlatList's fiber for the conversation, or null while none is
// mounted. The list is keyed by its conversation, and a conversation pushed under another stays
// mounted, so the conversation picks it.
// e2eListInternals(list): the VirtualizedList (FlatList's _listRef) fields the readers use.
// e2eThreadContexts(fiber): the conversation's centre context value and thread store, from the
// providers above its list.
export const threadListPrelude = `
  const e2eFail = what => { throw new Error('e2e thread reader: ' + what + ' (React Native or app internals changed?)') }
  const e2eVisibleConvID = () => {
    const screen = kbModule('constants/router.tsx').getVisibleScreen()
    return (screen && screen.params && screen.params.conversationIDKey) || null
  }
  const e2eThreadList = convID => {
    const hook = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__
    if (!hook || typeof hook.getFiberRoots !== 'function') e2eFail('no __REACT_DEVTOOLS_GLOBAL_HOOK__.getFiberRoots')
    let root
    for (const r of hook.getFiberRoots(1)) root = r
    if (!root || !root.current) e2eFail('no React root fiber')
    let keyed
    const stack = [root.current]
    while (stack.length) {
      const f = stack.pop()
      if (f.key === convID && f.memoizedProps && f.memoizedProps.testID === ${JSON.stringify(T.CHAT_MESSAGE_LIST)}) {
        if (f.stateNode && f.stateNode._listRef) return f
        keyed = f
      }
      if (f.sibling) stack.push(f.sibling)
      if (f.child) stack.push(f.child)
    }
    if (keyed) e2eFail('the thread list is mounted but no fiber of it has a FlatList instance with _listRef')
    return null
  }
  const e2eListInternals = list => {
    if (!list) e2eFail('FlatList._listRef is missing')
    const scrollRef = list._scrollRef
    if (!scrollRef || typeof scrollRef.getBoundingClientRect !== 'function') e2eFail('VirtualizedList._scrollRef.getBoundingClientRect is missing')
    if (!list._scrollMetrics || typeof list._scrollMetrics.offset !== 'number') e2eFail('VirtualizedList._scrollMetrics.offset is missing')
    const metrics = list._listMetrics
    if (!metrics || !(metrics._cellMetrics instanceof Map) || !('_contentLength' in metrics)) {
      e2eFail('VirtualizedList._listMetrics._cellMetrics / _contentLength are missing')
    }
    return {
      // a cell's measured offset (from the list's start) and length, and whether it is rendered
      cell: ordinal => {
        const m = metrics._cellMetrics.get(String(ordinal))
        if (m && (typeof m.offset !== 'number' || typeof m.length !== 'number' || typeof m.isMounted !== 'boolean')) {
          e2eFail('a VirtualizedList cell metric lacks offset / length / isMounted')
        }
        return m
      },
      contentLength: () => metrics._contentLength,
      offset: () => list._scrollMetrics.offset,
      view: () => scrollRef.getBoundingClientRect(),
    }
  }
  const e2eThreadContexts = fiber => {
    let center, store
    for (let p = fiber.return; p && !(center && store); p = p.return) {
      const v = p.memoizedProps && p.memoizedProps.value
      if (!v || typeof v !== 'object') continue
      if (!center && 'centeredOrdinal' in v && typeof v.hasCenter === 'boolean') center = v
      if (!store && typeof v.getState === 'function' && v.getState().messageMap instanceof Map) store = v
    }
    if (!center) e2eFail('no conversation centre context (a provider value with centeredOrdinal and hasCenter) above the thread list')
    if (!store) e2eFail('no thread store (a provider value whose state has a messageMap Map) above the thread list')
    return {center, store}
  }
`

// Reads the thread list of the conversation on screen, or null while none is mounted.
const readThreadBody = `${threadListPrelude}
  const convID = e2eVisibleConvID()
  if (!convID) return null
  const fiber = e2eThreadList(convID)
  if (!fiber) return null
  const list = e2eListInternals(fiber.stateNode._listRef)
  const view = list.view()
  const offset = list.offset()
  const newestFirst = fiber.memoizedProps.data
  if (!Array.isArray(newestFirst)) e2eFail('the thread FlatList has no data array')
  const {center, store} = e2eThreadContexts(fiber)
  const st = store.getState()
  const rows = []
  for (const ordinal of newestFirst) {
    const m = list.cell(ordinal)
    // a cell out of the rendered window keeps its last metrics, which a reload makes stale
    if (!m || !m.isMounted) continue
    // the list is inverted: a row's offset runs up from the viewport's bottom edge
    const bottom = view.y + view.height - (m.offset - offset)
    rows.push({bottom, ordinal, top: bottom - m.length})
  }
  rows.reverse()
  const kb = kbModule('node_modules/react-native/index.js').Keyboard.metrics()
  return {
    centeredOrdinal: center.centeredOrdinal,
    convID,
    keyboardTop: kb && kb.height > 0 ? kb.screenY : undefined,
    listBottom: view.y + view.height,
    listTop: view.y,
    moreToLoadBack: st.moreToLoadBack,
    moreToLoadForward: st.moreToLoadForward,
    offset,
    ordinals: [...newestFirst].reverse(),
    rows,
  }
`

export const readThread = async () => jsEval<ThreadReading | null>(readThreadBody)

// -- sampling the thread frame by frame ------------------------------------------------------------

// One tick of the in-app sampler: when (ms, the app's clock), the list's scroll offset, how many rows
// it has loaded, its view height, and the tops (window points) of the rendered rows in or near the
// view, as [ordinal, top].
export type ThreadSample = {count: number; height: number; offset: number; rows: Array<[number, number]>; t: number}

// Starts sampling the open thread every 16ms inside the app (a round trip through Metro takes longer
// than a frame). It finds the list once, then reads only its scroll metrics each tick.
const startThreadSampler = async () => {
  const ok = await jsEval<boolean>(`${threadListPrelude}
    const g = globalThis
    if (g.__e2eSampler) clearInterval(g.__e2eSampler)
    const convID = e2eVisibleConvID()
    const fiber = convID && e2eThreadList(convID)
    if (!fiber) return false
    const inst = fiber.stateNode
    e2eListInternals(inst._listRef)
    const now = g.nativePerformanceNow ? () => g.nativePerformanceNow() : () => Date.now()
    g.__e2eSamples = []
    g.__e2eSamplerError = undefined
    g.__e2eSampler = setInterval(() => {
      // gone once the list unmounts
      if (!inst._listRef) return
      // a throw here would land in the app's error overlay every tick: keep it for stopThreadSampler
      try {
        const list = e2eListInternals(inst._listRef)
        const view = list.view()
        const offset = list.offset()
        const data = inst.props.data || []
        const rows = []
        for (const ordinal of data) {
          const m = list.cell(ordinal)
          if (!m || !m.isMounted) continue
          const bottom = view.y + view.height - (m.offset - offset)
          // rows well outside the view only make the samples bigger
          if (bottom < view.y - 200 || bottom - m.length > view.y + view.height + 200) continue
          rows.push([ordinal, Math.round((bottom - m.length) * 10) / 10])
        }
        g.__e2eSamples.push({count: data.length, height: view.height, offset, rows, t: now()})
      } catch (e) {
        g.__e2eSamplerError = String((e && e.message) || e)
        clearInterval(g.__e2eSampler)
      }
    }, 16)
    return true
  `)
  if (!ok) throw new Error('no thread list on screen to sample')
}

const stopThreadSampler = async () => {
  const {error, samples} = await jsEval<{error: string | null; samples: Array<ThreadSample>}>(`
    const g = globalThis
    if (g.__e2eSampler) clearInterval(g.__e2eSampler)
    g.__e2eSampler = undefined
    const s = g.__e2eSamples || []
    const error = g.__e2eSamplerError || null
    g.__e2eSamples = undefined
    g.__e2eSamplerError = undefined
    return {error, samples: s}
  `)
  if (error) throw new Error(`the thread sampler stopped: ${error}`)
  return samples
}

// Samples the thread while `body` runs, and returns the samples.
export const sampleThreadWhile = async (body: () => Promise<unknown>) => {
  await startThreadSampler()
  try {
    await body()
  } catch (e) {
    await stopThreadSampler().catch(() => [])
    throw e
  }
  return stopThreadSampler()
}

export const sampleTop = (s: ThreadSample, ordinal: number) => s.rows.find(([o]) => o === ordinal)?.[1]

export const requireThread = async () => {
  const t = await readThread()
  if (!t) throw new Error('no thread list on screen')
  return t
}

// The visible conversation's thread store (from the provider above its list), as `store` and `st`;
// both undefined while no thread list is mounted.
const threadStoreBody = `${threadListPrelude}
  const convID = e2eVisibleConvID()
  const listFiber = convID ? e2eThreadList(convID) : null
  const store = listFiber ? e2eThreadContexts(listFiber).store : undefined
  const st = store && store.getState()
  const bodyOf = m => (m.text && m.text.stringValue ? m.text.stringValue() : '') + ' ' + (m.title || '')
`

// The ordinals of the loaded messages whose text (or attachment title) contains `text`, oldest first.
export const ordinalsWithText = async (text: string) =>
  jsEval<Array<number>>(`${threadStoreBody}
    if (!st) return []
    return (st.messageOrdinals || []).filter(o => {
      const m = st.messageMap.get(o)
      return m && bodyOf(m).includes(${JSON.stringify(text)})
    })
  `)

// The first line of the loaded message's text: what its row is named by.
export const rowText = async (ordinal: number) => {
  const text = await jsEval<string | null>(`${threadStoreBody}
    const m = st && st.messageMap.get(${ordinal})
    return m ? bodyOf(m).trim().split('\\n')[0] : null
  `)
  if (!text) throw new Error(`no loaded message at ordinal ${ordinal}`)
  return text
}

// A loaded message, as the store holds the parts the flows read.
export type StoredMessage = {reactions: Array<{emoji: string; users: Array<string>}>; text: string; type: string}
export const storedMessage = async (ordinal: number) =>
  jsEval<StoredMessage | null>(`${threadStoreBody}
    const m = st && st.messageMap.get(${ordinal})
    if (!m) return null
    const reactions = []
    if (m.reactions) for (const [emoji, r] of m.reactions) reactions.push({emoji, users: [...(r.users || [])].map(u => u.username)})
    return {reactions, text: bodyOf(m).trim(), type: m.type}
  `)

// Waits for the one message containing `text` to be in the thread and returns its ordinal.
export const waitForRow = async (text: string, timeout = 15_000) =>
  waitFor(
    `a row with "${text}"`,
    async () => {
      const found = await ordinalsWithText(text)
      if (found.length > 1) throw new Error(`${found.length} rows contain "${text}"`)
      return found[0]
    },
    {interval: 250, timeout}
  )

// The bottom of the thread a reader can see: the top of the composer, or of the search bar that
// takes its place while thread search is open.
export const composerTop = async () => {
  const search = el(T.CHAT_THREAD_SEARCH)
  if (await search.isExisting()) return search.getLocation('y')
  // the input sits in the composer bar with a margin above it
  return (await el(T.CHAT_INPUT).getLocation('y')) - 8
}

// The part of the list a reader sees: from its top down to the composer (the keyboard sits below
// the composer when it is up, which the composer's top already accounts for).
export type Viewport = {bottom: number; top: number}
export const viewport = async (t?: ThreadReading): Promise<Viewport> => {
  const reading = t ?? (await requireThread())
  return {bottom: await composerTop(), top: reading.listTop}
}

export const rowOf = (t: ThreadReading, ordinal: number) => t.rows.find(r => r.ordinal === ordinal)

// How far the newest loaded row's bottom sits above the composer's top (0 or a little more at the end
// of a thread holding its newest message).
export const newestGap = (t: ThreadReading, v: Viewport) => {
  const newest = t.rows.at(-1)
  return newest ? v.bottom - newest.bottom : undefined
}

// A row wholly in the reader's view.
export const wholly = (r: ThreadRow | undefined, v: Viewport, margin = 0) =>
  !!r && r.top >= v.top + margin - 1 && r.bottom <= v.bottom - margin + 1

// How far the row's middle sits from the middle of the reader's view (positive: below it).
export const centreOffset = (r: ThreadRow, v: Viewport) => (r.top + r.bottom) / 2 - (v.top + v.bottom) / 2

const sameReading = (a: ThreadReading, b: ThreadReading) =>
  Math.abs(a.offset - b.offset) < 0.5 &&
  a.ordinals.length === b.ordinals.length &&
  a.rows.length === b.rows.length &&
  a.rows.every((r, i) => Math.abs(r.top - (b.rows[i]?.top ?? Infinity)) < 0.5)

// Waits until two readings 300ms apart agree, and returns the second.
export const waitForThreadStable = async (timeout = 10_000) => {
  const end = Date.now() + timeout
  let last: ThreadReading | null | undefined
  for (;;) {
    const a = await readThread()
    await sleep(300)
    const b = await readThread()
    if (a && b && sameReading(a, b)) return b
    last = b
    if (Date.now() > end) {
      throw new Error(`the thread did not settle within ${timeout}ms (last offset ${last?.offset}, ${last?.rows.length} rows)`)
    }
  }
}

// At the end: holding the newest message (nothing newer to load), resting at the offset the list
// keeps its newest row above the composer from, with that row in view.
export const endGapMax = 40
export const isAtEnd = (t: ThreadReading, v: Viewport) => {
  const gap = newestGap(t, v)
  return !t.moreToLoadForward && gap !== undefined && gap >= -1 && gap <= endGapMax
}

export const summary = (t: ThreadReading, v?: Viewport) =>
  JSON.stringify({
    centered: t.centeredOrdinal,
    keyboardTop: t.keyboardTop,
    list: [t.listTop, t.listBottom],
    loaded: [t.ordinals[0], t.ordinals.at(-1), t.ordinals.length],
    moreBack: t.moreToLoadBack,
    moreForward: t.moreToLoadForward,
    newest: t.rows.at(-1),
    newestGap: v ? newestGap(t, v) : undefined,
    offset: t.offset,
    oldest: t.rows[0],
    viewport: v,
  })

// -- moving the thread as a reader --------------------------------------------------------------

// A finger drag on the thread from one point to another, held still before lifting so the list
// does not fling on. Positive dy drags the content down (toward older messages).
export const dragThread = async (dy: number, {x}: {x?: number} = {}) => {
  const t = await requireThread()
  const v = await viewport(t)
  const {width} = await browser.getWindowRect()
  const px = x ?? Math.round(width * 0.5)
  const mid = (v.top + v.bottom) / 2
  const from = Math.round(dy > 0 ? mid - Math.min(dy, v.bottom - v.top - 40) / 2 : mid + Math.min(-dy, v.bottom - v.top - 40) / 2)
  const to = Math.round(from + Math.sign(dy) * Math.min(Math.abs(dy), v.bottom - v.top - 40))
  await browser
    .action('pointer', {parameters: {pointerType: 'touch'}})
    .move({x: px, y: from})
    .down()
    .move({duration: 600, x: px, y: to})
    .pause(400)
    .up()
    .perform()
}

// A quick flick: the list keeps going after the finger lifts. Positive dy flicks toward older rows.
export const flickThread = async (dy: number) => {
  const t = await requireThread()
  const v = await viewport(t)
  const {width} = await browser.getWindowRect()
  const x = Math.round(width * 0.5)
  const mid = Math.round((v.top + v.bottom) / 2)
  const half = Math.round(Math.min(Math.abs(dy), v.bottom - v.top - 60) / 2)
  const [from, to] = dy > 0 ? [mid - half, mid + half] : [mid + half, mid - half]
  await browser
    .action('pointer', {parameters: {pointerType: 'touch'}})
    .move({x, y: from})
    .down()
    .move({duration: 80, x, y: to})
    .up()
    .perform()
}

// Taps the status bar, which asks the list to scroll to its top (for this inverted list, its end).
export const tapStatusBar = async () => {
  const {width} = await browser.getWindowRect()
  await browser.execute('mobile: tap', {x: Math.round(width / 2), y: 8})
}

// -- conversations ------------------------------------------------------------------------------

// Opens a conversation by id through a keybase://convid link (the deep-link path the app itself
// handles), from the chat tab's root, so the thread mounts afresh. Waits for its list to read.
export const openConversation = async (convID: string) => {
  await hideKeyboard()
  await escapeToTabs()
  await navigateToChat()
  openUrl(`keybase://convid/${convID}`)
  await waitFor(
    'the conversation to open',
    async () => {
      const {screen} = await appSnapshot()
      return screen?.name === 'chatConversation' && screen.params?.['conversationIDKey'] === convID ? true : undefined
    },
    {interval: 250, timeout: 20_000}
  )
  await waitForTestID(T.CHAT_INPUT, 15_000)
  // JS names the screen before the native push lands; until it does the tab root still looks current
  await browser.waitUntil(async () => !(await atTabs()), {interval: 150, timeout: 5_000}).catch(() => {})
  await waitFor('the thread list', async () => ((await readThread())?.convID === convID ? true : undefined), {
    interval: 250,
    timeout: 15_000,
  })
}

// -- accounts -----------------------------------------------------------------------------------

type Account = {loggedIn: boolean; switching: boolean; username: string}
export const signedInAs = async () =>
  jsEval<Account>(`
    const c = kbModule('stores/config.tsx').useConfigState.getState()
    return {loggedIn: c.loggedIn, switching: c.userSwitching, username: kbModule('stores/current-user.tsx').useCurrentUserState.getState().username}
  `)

// Switches the app to another account signed in on this device, through the account switcher the
// chat tab's avatar opens, and waits for the switch to finish.
export const switchAppAccount = async (username: string) => {
  const now = await signedInAs()
  if (now.loggedIn && !now.switching && now.username === username) return
  await escapeToTabs()
  await navigateToChat()
  // a row reads "<name>" or "<name>, <full name>"; the inbox's rows read "<name>, <time>, ..." too
  const row = browser.$(
    `-ios predicate string:type == "XCUIElementTypeOther" AND (label == "${username}" OR label BEGINSWITH "${username}, ") AND name != ${JSON.stringify(T.CHAT_INBOX_ROW)} AND visible == 1`
  )
  const switcherOpen = async () => byText('Log in as another user').isExisting()
  await waitFor(
    'the account switcher',
    async () => {
      if (await switcherOpen()) return true
      await el(T.PEOPLE_HEADER_AVATAR).click().catch(() => {})
      return (await byText('Log in as another user').waitForExist({interval: 150, timeout: 3_000}).catch(() => false))
        ? true
        : undefined
    },
    {interval: 500, timeout: 20_000}
  )
  await waitFor(
    'the account switch',
    async () => {
      const a = await signedInAs().catch(() => undefined)
      if (a && a.loggedIn && !a.switching && a.username === username) return true
      // the sheet ignores a tap while it is still sliding in; tap again until the switch starts
      if (a && !a.switching && (await switcherOpen()) && (await row.isExisting().catch(() => false))) {
        await row.click().catch(() => {})
      }
      return undefined
    },
    {interval: 1_000, timeout: 60_000}
  )
  await escapeToTabs()
}

// Deletes a team channel as the app's account (an admin of the team): an evaluate returns
// synchronously, so it starts the RPC and polls for its outcome.
export const deleteChannelAsApp = async (convID: string, channelName: string) => {
  const key = `__e2eDelete${Date.now()}`
  await jsEval(`
    const g = globalThis; g.${key} = 'pending'
    kbModule('constants/rpc/rpc-chat-gen.tsx')
      .localDeleteConversationLocalRpcPromise({
        channelName: ${JSON.stringify(channelName)},
        confirmed: true,
        convID: kbModule('constants/types/chat/index.tsx').keyToConversationID(${JSON.stringify(convID)}),
      })
      .then(() => { g.${key} = 'done' }, e => { g.${key} = 'error: ' + (e && e.message) })
    return true
  `)
  const state = await waitFor(
    `#${channelName} to be deleted`,
    async () => {
      const now = await jsEval<string>(`return globalThis.${key}`)
      return now === 'pending' ? undefined : now
    },
    {interval: 250, timeout: 20_000}
  )
  if (state !== 'done') throw new Error(`deleting #${channelName} failed: ${state}`)
}

// -- composer ------------------------------------------------------------------------------------

// The composer's text, read from the input element.
export const composerText = async () => {
  const v = await el(T.CHAT_INPUT).getAttribute('value')
  // an empty UITextView reports its placeholder as its value
  const placeholder = await el(T.CHAT_INPUT).getAttribute('placeholderValue').catch(() => null)
  return v === null || v === placeholder ? '' : v
}

export const waitForComposerText = async (text: string, timeout = 5_000) =>
  waitFor(`the composer to read "${text}"`, async () => ((await composerText()) === text ? true : undefined), {
    interval: 200,
    timeout,
  })

// Types into the composer key by key, as a user does (it takes focus first).
export const typeInComposer = async (text: string) => {
  await el(T.CHAT_INPUT).click()
  await el(T.CHAT_INPUT).addValue(text)
}

export const clearComposer = async () => {
  if ((await composerText()) === '') return
  await el(T.CHAT_INPUT).clearValue()
  await waitForComposerText('')
}

// Sends `text` through the composer's send button and returns the ordinal of its row.
export const sendMessage = async (text: string) => {
  await typeInComposer(text)
  await waitForTestID(T.CHAT_SEND_BUTTON, 5_000)
  await el(T.CHAT_SEND_BUTTON).click()
  return waitForRow(text)
}

export const isKeyboardUp = async () => browser.isKeyboardShown().catch(() => false)

// Closes the keyboard the way the app does (WDA's own hideKeyboard cannot find a way to close this
// app's keyboards), and waits for it to go.
export const hideKeyboard = async () => {
  if (!(await isKeyboardUp())) return
  await jsEval(`kbModule('node_modules/react-native/index.js').Keyboard.dismiss(); return true`)
  await waitFor('the keyboard to close', async () => ((await isKeyboardUp()) ? undefined : true), {interval: 200, timeout: 5_000})
}

// -- a message's menu ----------------------------------------------------------------------------

const menuSheet = () => browser.$('-ios predicate string:label == "Bottom Sheet" AND visible == 1')

// Long-presses the message showing `text` (at its middle, found afresh each try) to open its menu,
// a bottom sheet, and waits for the sheet.
export const openMessageMenu = async (text: string) => {
  await waitFor(
    `the menu of the message "${text}"`,
    async () => {
      if (await menuSheet().isExisting()) return true
      const {x, y} = await rowCentre(text)
      await browser.execute('mobile: touchAndHold', {duration: 0.8, x, y})
      return (await menuSheet().waitForExist({interval: 150, timeout: 3_000}).catch(() => false)) ? true : undefined
    },
    {interval: 300, timeout: 15_000}
  )
}

// The row showing `text` in the thread list (rows expose their text as their accessibility name;
// the reply bar and the composer can quote the same text), and its middle in window points.
export const rowElement = (text: string) =>
  browser.$(`~${T.CHAT_MESSAGE_LIST}`).$(`-ios predicate string:name BEGINSWITH ${JSON.stringify(text)} AND visible == 1`)

export const rowCentre = async (text: string) => {
  const row = rowElement(text)
  const {x, y} = await row.getLocation()
  const {height, width} = await row.getSize()
  return {x: Math.round(x + width / 2), y: Math.round(y + height / 2)}
}

// An item in the open message menu; its rows read ", <item>" (an icon, then the text).
const menuItemPredicate = (label: string) =>
  `-ios predicate string:type == "XCUIElementTypeOther" AND (label == ${JSON.stringify(label)} OR label ENDSWITH ${JSON.stringify(`, ${label}`)})`
export const menuItem = (label: string) => browser.$(`${menuItemPredicate(label)} AND visible == 1`)
export const menuHas = async (label: string) => browser.$(menuItemPredicate(label)).isExisting()

// Scrolls the menu until `label` shows, and taps it. The sheet opens partway, so later items start
// below the screen.
export const chooseMenuItem = async (label: string) => {
  await waitFor(
    `"${label}" in the message menu`,
    async () => {
      const item = menuItem(label)
      if (await item.isExisting()) {
        const {y} = await item.getLocation()
        const {height} = await browser.getWindowRect()
        if (y < height - 60) return true
      }
      const {height, width} = await browser.getWindowRect()
      const x = Math.round(width / 2)
      await browser
        .action('pointer', {parameters: {pointerType: 'touch'}})
        .move({x, y: height - 80})
        .down()
        .move({duration: 400, x, y: height - 380})
        .pause(200)
        .up()
        .perform()
      return undefined
    },
    {interval: 300, timeout: 15_000}
  )
  await menuItem(label).click()
  await menuSheet().waitForExist({reverse: true, timeout: 5_000})
}

export const closeMessageMenu = async () => {
  if (!(await menuSheet().isExisting())) return
  await browser.$('-ios predicate string:label == "Bottom sheet backdrop"').click()
  await menuSheet().waitForExist({reverse: true, timeout: 5_000})
}

// -- thread search -------------------------------------------------------------------------------

// The search bar's parts are its siblings in the accessibility tree, not its children.
const searchInput = () =>
  browser.$('-ios predicate string:type == "XCUIElementTypeTextField" AND placeholderValue == "Search..." AND visible == 1')

// An item in the conversation header's native menu (the "More" button).
const headerMenuItem = (label: string) =>
  browser.$(
    `-ios predicate string:(type == "XCUIElementTypeButton" OR type == "XCUIElementTypeMenuItem" OR type == "XCUIElementTypeOther") AND label == ${JSON.stringify(label)} AND visible == 1`
  )

// Opens `item` from the conversation header's menu, and waits for `opened` to say it took.
export const openHeaderMenuItem = async (item: string, opened: () => Promise<boolean>) => {
  await hideKeyboard()
  await waitFor(
    `${item} to open from the header menu`,
    async () => {
      if (await opened()) return true
      if (await headerMenuItem(item).isExisting()) {
        await headerMenuItem(item).click().catch(() => {})
      } else {
        await browser.$('~More').click().catch(() => {})
      }
      return undefined
    },
    {interval: 500, timeout: 15_000}
  )
}

export const openThreadSearch = async () => openHeaderMenuItem('Search', async () => el(T.CHAT_THREAD_SEARCH).isExisting())

const counterText = async () => {
  const counter = browser.$(
    '-ios predicate string:type == "XCUIElementTypeStaticText" AND (label == "No results" OR label MATCHES "\\\\d+ of \\\\d+") AND visible == 1'
  )
  return (await counter.isExisting()) ? counter.getText() : undefined
}

// The search bar's text as the app holds it (its input's value prop), which trails the keys typed
// into the native field while the JS thread is busy.
const searchBarText = async () =>
  jsEval<string | null>(`
    const hook = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__
    let root
    for (const r of hook.getFiberRoots(1)) root = r
    const stack = [root.current]
    while (stack.length) {
      const f = stack.pop()
      const p = f.memoizedProps
      if (p && p.placeholder === 'Search...' && typeof p.onEnterKeyDown === 'function') return p.value
      if (f.sibling) stack.push(f.sibling)
      if (f.child) stack.push(f.child)
    }
    return null
  `)

// Runs a search (typing the query and pressing return) and waits for its counter; returns it
// ("1 of 1"). The first hit is selected, and the thread centres on it. The app's service starts
// with the app, and a search in the first moments after a launch can finish with "No results"
// for a message that is there (seen once, the first search after a relaunch); such a search is
// run again, and said so, until the deadline.
//
// Return searches for whatever text the app holds at that moment. Pressed in the same run of keys
// as the query, with the JS thread busy, it went out as a prefix of it ("quokk" for
// "quokkadeepmarker", in Metro's RPC log), which matches every seeded token sharing that prefix
// ("1 of 3"). So the query is typed, the app is waited for until it holds all of it, and only then
// is return pressed.
export const searchFor = async (query: string, timeout = 30_000) => {
  const input = searchInput()
  const end = Date.now() + timeout
  for (;;) {
    await input.waitForExist({timeout: 5_000})
    await input.clearValue().catch(() => {})
    await input.addValue(query)
    await waitFor(`the search bar to hold "${query}"`, async () => ((await searchBarText()) === query ? true : undefined), {
      interval: 100,
      timeout: 10_000,
    })
    await input.addValue('\n')
    const counter = await waitFor('the thread search to finish', async () => counterText(), {
      interval: 250,
      timeout: Math.max(1_000, end - Date.now()),
    })
    if (counter !== 'No results' || Date.now() > end) return counter
    console.log(`the search for ${query} found no results; searching again`)
    // the bar steps through its hits when the same text is entered again, so it opens afresh
    await sleep(2_000)
    await closeSearch()
    await openThreadSearch()
  }
}

// Presses return in the search box again: with the same query, that selects the next hit (the same
// one again when there is one).
export const searchAgain = async () => {
  await searchInput().addValue('\n')
}

export const closeSearch = async () => {
  const cancel = browser.$('-ios predicate string:type == "XCUIElementTypeStaticText" AND label == "Cancel" AND visible == 1')
  await cancel.click()
  await el(T.CHAT_THREAD_SEARCH).waitForExist({reverse: true, timeout: 5_000})
}

export const searchOpen = async () => el(T.CHAT_THREAD_SEARCH).isExisting()

// -- misc --------------------------------------------------------------------------------------

export const jumpToRecentButton = () => el(T.CHAT_JUMP_TO_RECENT)
export const catchUpPill = () => el(T.CHAT_CATCH_UP)
export const replyPreview = () => el(T.CHAT_REPLY_PREVIEW)
export const pinnedBanner = () => el(T.CHAT_PINNED_BANNER)
export const editCancel = () => el(T.CHAT_EDIT_CANCEL)


// -- assertions ----------------------------------------------------------------------------------

export const check = (ok: boolean, message: string) => {
  if (!ok) throw new Error(message)
}

// Waits for the thread to settle and checks it rests at its end.
// A still reading can land mid-animation: the list follows a new message with an animated scroll of
// about 250ms, and a JS thread busy loading pages can hold a frame of it for longer than the 300ms
// between readings (a reading 20.7 points short matched one frame of that animation). So a reading
// short of the end is taken again, for up to 3s, before it counts.
export const expectAtEnd = async (what = 'the thread') => {
  const end = Date.now() + 3_000
  for (;;) {
    const t = await waitForThreadStable()
    const v = await viewport(t)
    if (isAtEnd(t, v)) return {t, v}
    if (Date.now() > end) throw new Error(`${what} is not at its end: ${summary(t, v)}`)
    await sleep(250)
  }
}

// The list centres a row by index (it settles once the row is within half a row of the middle of
// the rows in view), so a centred row sits within a row or so of the middle of what the reader sees.
export const centreTolerance = (v: Viewport) => Math.max(48, (v.bottom - v.top) * 0.1)

// Waits for `ordinal` to be centred and the thread to settle, and checks it stays centred.
export const expectCentred = async (ordinal: number, timeout = 10_000) => {
  let last = ''
  try {
    await waitFor(
      `row ${ordinal} to be centred`,
      async () => {
        const t = await readThread()
        if (!t) return undefined
        const v = await viewport(t)
        const r = rowOf(t, ordinal)
        last = `${JSON.stringify(r)} ${summary(t, v)}`
        return r && Math.abs(centreOffset(r, v)) <= centreTolerance(v) ? true : undefined
      },
      {interval: 250, timeout}
    )
  } catch (e) {
    throw new Error(`${e instanceof Error ? e.message : String(e)}; last reading ${last}`, {cause: e})
  }
  const t = await waitForThreadStable()
  const v = await viewport(t)
  const r = rowOf(t, ordinal)
  check(!!r && Math.abs(centreOffset(r, v)) <= centreTolerance(v), `row ${ordinal} is not centred: ${JSON.stringify(r)} ${summary(t, v)}`)
  return {t, v}
}

// A row wholly in view, at least `margin` points inside both edges, for the reader to be looking at.
export const pickAnchor = (t: ThreadReading, v: Viewport, margin = 20) => {
  const row = t.rows.find(r => wholly(r, v, margin))
  if (!row) throw new Error(`no row wholly in view with a ${margin}pt margin: ${summary(t, v)}`)
  return row
}

// Runs a check that fails today because of an app bug (named where it is called). The test passes
// while the check fails, and fails once the check passes, so the mark is removed with the fix.
export const expectedFailure = async (bug: string, body: () => unknown) => {
  try {
    await body()
  } catch (e) {
     
    console.log(`expected failure (${bug}): ${e instanceof Error ? e.message : String(e)}`)
    return
  }
  throw new Error(`passes now, so the app bug it marks looks fixed; remove the expected-failure mark (${bug})`)
}

// Whether an element whose label contains `text` sits inside the element with testID `id` (the tree
// is flattened, so what a box shows are its siblings, placed inside its rect).
export const showsText = async (id: string, text: string) => {
  const box = el(id)
  if (!(await box.isExisting())) return false
  const {x, y} = await box.getLocation()
  const {height, width} = await box.getSize()
  const found = await browser.$$(`-ios predicate string:label CONTAINS ${JSON.stringify(text)} AND visible == 1`).getElements()
  for (const e of found) {
    const at = await e.getLocation().catch(() => undefined)
    if (at && at.x >= x - 1 && at.x <= x + width && at.y >= y - 1 && at.y <= y + height) return true
  }
  return false
}

// Where a message is in its delete: shown, shown while its delete is in flight, or gone.
export type DeletePhase = 'gone' | 'row' | 'row+deleting'
export const deletePhase = async (ordinal: number) =>
  jsEval<DeletePhase>(`${threadStoreBody}
    if (!st || !(st.messageOrdinals || []).includes(${ordinal})) return 'gone'
    return [...st.pendingDeleteMap.values()].includes(${ordinal}) ? 'row+deleting' : 'row'
  `)

// The chat badge's unread count for a conversation.
export const unreadCount = async (convID: string) =>
  jsEval<number>(`return (kbModule('chat/inbox/badge-state.tsx').useInboxBadgeState.getState().counts.get(${JSON.stringify(convID)}) || {}).unreadCount || 0`)

// The ordinals the thread draws an orange line above (read off the rendered separators: the line's
// box, keyed "orangeLine", sits in the separator for the message below it).
export const orangeLineOrdinals = async () =>
  jsEval<Array<number>>(`${threadListPrelude}
    const convID = e2eVisibleConvID()
    const list = convID && e2eThreadList(convID)
    if (!list) return []
    const out = []
    const inner = [list.child]
    while (inner.length) {
      const f = inner.pop()
      if (!f) continue
      if (f.key === 'orangeLine') {
        for (let p = f.return; p; p = p.return) {
          if (p.memoizedProps && p.memoizedProps.trailingItem !== undefined) {
            out.push(p.memoizedProps.trailingItem)
            break
          }
        }
      }
      if (f.sibling) inner.push(f.sibling)
      if (f.child) inner.push(f.child)
    }
    return out
  `)

// The conversation the visible screen shows.
export const visibleConversation = async () =>
  jsEval<string | null>(`const s = kbModule('constants/router.tsx').getVisibleScreen(); return (s && s.params && s.params.conversationIDKey) || null`)

// -- standing in for the service, and reading what the app asked of it ---------------------------

// Watches the visible thread's row at `ordinal` from inside the app, every 16ms: logs each change of
// its delete phase to the console (so Metro's log holds it in order with the RPC log), and from the
// moment its delete is in flight hands the app a ChatThreadsStale for the conversation every 100ms,
// as the service sends one when a thread changed underneath it; each makes the thread reload. Stops
// by itself once the row is gone or after 15s.
export const watchDeleteThroughReloads = async (ordinal: number) => {
  const ok = await jsEval<boolean>(`${threadStoreBody}
    if (!store) return false
    const g = globalThis
    if (g.__e2eDeleteWatch) clearInterval(g.__e2eDeleteWatch)
    const router = kbModule('chat/notification-router.tsx')
    const types = kbModule('constants/types/chat/index.tsx')
    const started = Date.now()
    let phase
    let lastStale = Date.now()
    g.__e2eStaleCount = 0
    g.__e2eDeleteWatch = setInterval(() => {
      const s = store.getState()
      const now = !(s.messageOrdinals || []).includes(${ordinal}) ? 'gone' : [...s.pendingDeleteMap.values()].includes(${ordinal}) ? 'row+deleting' : 'row'
      if (now !== phase) {
        phase = now
        console.log('e2e-row-phase ' + now)
      }
      if (now === 'gone' || Date.now() - started > 15000) {
        clearInterval(g.__e2eDeleteWatch)
        g.__e2eDeleteWatch = undefined
        return
      }
      if (now === 'row+deleting' && Date.now() - lastStale >= 100) {
        lastStale = Date.now()
        g.__e2eStaleCount++
        router.routeChatNotification({
          payload: {params: {updates: [{convID: types.keyToConversationID(convID), updateType: 1}]}},
          type: 'chat.1.NotifyChat.ChatThreadsStale',
        })
      }
    }, 16)
    return true
  `)
  if (!ok) throw new Error('no thread store on screen to watch')
}

export const staleNotificationsSent = async () => jsEval<number>(`return globalThis.__e2eStaleCount || 0`)

// Chooses Delete in the open message menu from inside the app, right behind a ChatThreadsStale for
// the visible conversation in the same task: the thread's reload is asked for just ahead of the
// delete, so its pass can come back while the delete is still on its way (a phone's delete lands
// within a tick or two of the tap, before a reload the tap starts). The menu stays open; close it
// after.
export const chooseDeleteBehindAReload = async () => {
  const ok = await jsEval<boolean>(`
    const screen = kbModule('constants/router.tsx').getVisibleScreen()
    const convID = screen && screen.params && screen.params.conversationIDKey
    const hook = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__
    let root
    for (const r of hook.getFiberRoots(1)) root = r
    let onClick
    const stack = [root.current]
    while (stack.length && !onClick) {
      const f = stack.pop()
      const p = f.memoizedProps
      const item = p && (p.item || p)
      if (item && item.title === 'Delete' && item.rightTitle === 'for everyone' && typeof item.onClick === 'function') onClick = item.onClick
      if (f.sibling) stack.push(f.sibling)
      if (f.child) stack.push(f.child)
    }
    if (!onClick || !convID) return false
    globalThis.__e2eStaleCount = (globalThis.__e2eStaleCount || 0) + 1
    kbModule('chat/notification-router.tsx').routeChatNotification({
      payload: {params: {updates: [{convID: kbModule('constants/types/chat/index.tsx').keyToConversationID(convID), updateType: 1}]}},
      type: 'chat.1.NotifyChat.ChatThreadsStale',
    })
    onClick()
    return true
  `)
  if (!ok) throw new Error('no Delete for everyone in an open message menu')
}

// What the app logged, in order, from Metro's log lines: its e2e-row-phase markers, and 'pass' for
// each thread pass the service sent it (chatThreadCached / chatThreadFull).
export const rowPhasesAndPasses = (lines: ReadonlyArray<string>) =>
  lines.flatMap(l => {
    const phase = /e2e-row-phase (\S+)/.exec(l)?.[1]
    if (phase) return [phase]
    return /IN >>.*chat\.1\.chatUi\.chatThread(Cached|Full)/.test(l) ? ['pass'] : []
  })

// The waiting keys the app holds right now (a spinner or a disabled control waits on each).
export const heldWaitingKeys = async () =>
  jsEval<Array<string>>(
    `return [...kbModule('stores/waiting.tsx').useWaitingState.getState().counts].filter(([, n]) => n > 0).map(([k]) => k)`
  )

const accountChangedMarker = 'e2e-signed-in-account-changed'

// Logs a marker to the console the moment the signed-in account changes, so Metro's log shows which
// of the app's calls came after it.
export const markAccountChange = async () =>
  jsEval(`
    const g = globalThis
    if (g.__e2eUidWatch) g.__e2eUidWatch()
    g.__e2eUidWatch = kbModule('stores/current-user.tsx').useCurrentUserState.subscribe((s, prev) => {
      if (s.uid !== prev.uid) console.log(${JSON.stringify(accountChangedMarker)})
    })
    return true
  `)

// The RPCs the app sent, read off Metro's log lines in order, each marked with whether the marker of
// markAccountChange came before it.
export const outgoingRpcs = (lines: ReadonlyArray<string>) => {
  let changed = false
  const calls: Array<{afterAccountChange: boolean; method: string; params: string}> = []
  for (const l of lines) {
    if (l.includes(accountChangedMarker)) changed = true
    const call = /<< OUT\s*((?:chat|keybase)\.1\.[\w.]+)\[\+calling\].*?\[\+calling\] \S+ (\{.*)$/.exec(l)
    if (call) calls.push({afterAccountChange: changed, method: call[1]!, params: call[2]!})
  }
  return calls
}

// Starts a switch to another account signed in on this device through the app's own switch (what
// the account switcher's row calls), for a flow that keeps typing while it runs.
export const startAppAccountSwitch = async (username: string) => {
  const started = await jsEval<boolean>(
    `return !!kbModule('stores/config.tsx').useConfigState.getState().dispatch.switchToAccount(${JSON.stringify(username)})`
  )
  if (!started) throw new Error(`the app would not switch to ${username}`)
}
