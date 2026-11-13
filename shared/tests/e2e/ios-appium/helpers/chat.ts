// Chat helpers for the iOS flows: open a seeded conversation, drive the composer, thread search and
// a message's menu, and read the thread as the list holds it.
//
// Geometry comes from the running app through Metro (jsEval), read off the React tree the way React
// DevTools reads it: the thread's FlatList (its scroll offset, its viewport's window rect, and the
// offset and height it measured for each row), the conversation's centre, and its thread store.
// Nothing in the app is added for the tests to read. Positions are window points, the same space as
// Appium's element rects, so they compare with the composer's and the keyboard's.
import {createHash} from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import type {ChainablePromiseElement} from 'webdriverio'
import {byText, clearFieldByKeys, el, els, fieldText, pasteFromMenu, waitForTestID} from './elements'
import {appSnapshot, openUrl, waitFor} from './lifecycle'
import {check, menuSheet, openSheets, openSheetWith, waitForSheetGone} from './menus'
import {atTabs, escapeToTabs, navigateToChat} from './navigate'
import {fiberPrelude} from './fiber-prelude'
import * as T from '../../shared/test-ids'
import {downloadFromCli, type CliMessage} from '../../shared/chat-data'
import {e2eRunId} from '../../shared/run-marker'
import {APP_ACCOUNT_BODY, type AppAccount} from '../gate/app-account-lib.ts'
import {askApp, jsEval} from '../gate/app-ask.ts'
import {isAttemptOver} from '../gate/attempt-binding-lib.ts'
import {underDeadline} from '../../shared/deadline.ts'
import {withHarnessRpcs} from '../gate/recorder.ts'
import {
  carriedTeam,
  findInboxHeader,
  findInboxRow,
  frameInside,
  inboxRowCandidates,
  isOneOnOneRow,
  type AppSmallRow,
  inboxIn,
  innermost,
  persistedMismatch,
  rectOf as frameOf,
  type Rect as Frame,
  shiftIntoBand,
  type DrawnInboxItem,
  type Span,
  visibleBand,
  wholly as whollyInBand,
} from '../gate/chat-lib.ts'
import {sourceElements} from '../gate/page-source-lib.ts'
import {loadE2EAccounts} from '../../accounts/env'
import {relaunchApp} from '../gate/device.ts'

const sleep = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

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
// It starts with fiberPrelude (e2eRootFiber, e2eHostOf), so a body that has it needs no other.
export const threadListPrelude = `${fiberPrelude}
  const e2eFail = what => { throw new Error('e2e thread reader: ' + what + ' (React Native or app internals changed?)') }
  const e2eVisibleConvID = () => {
    const screen = kbModule('constants/router.tsx').getVisibleScreen()
    return (screen && screen.params && screen.params.conversationIDKey) || null
  }
  const e2eThreadList = convID => {
    let keyed
    const stack = [e2eRootFiber()]
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
  `, {once: true})
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
  `, {once: true})
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
// both undefined while no thread list is mounted. A reader whose empty answer means "not in the
// thread" calls e2eRequireThreadStore() first, so a missing store is never read as gone.
export const threadStoreBody = `${threadListPrelude}
  const convID = e2eVisibleConvID()
  const listFiber = convID ? e2eThreadList(convID) : null
  const store = listFiber ? e2eThreadContexts(listFiber).store : undefined
  const st = store && store.getState()
  const bodyOf = m => (m.text && m.text.stringValue ? m.text.stringValue() : '') + ' ' + (m.title || '')
  const e2eRequireThreadStore = () => {
    if (!st) throw new Error('no thread store: no thread list is mounted for the visible conversation')
  }
`

// The ordinals of the loaded messages whose text (or attachment title) contains `text`, oldest first.
// Throws while no thread is mounted.
export const ordinalsWithText = async (text: string) =>
  jsEval<Array<number>>(`${threadStoreBody}
    e2eRequireThreadStore()
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

// A loaded message, as the store holds the parts the flows read: `id` is its message id (0 until the
// service has one for it).
type StoredMessage = {
  author: string
  id: number
  reactions: Array<{emoji: string; users: Array<string>}>
  text: string
  type: string
}
export const storedMessage = async (ordinal: number) =>
  jsEval<StoredMessage | null>(`${threadStoreBody}
    const m = st && st.messageMap.get(${ordinal})
    if (!m) return null
    const reactions = []
    if (m.reactions) for (const [emoji, r] of m.reactions) reactions.push({emoji, users: [...(r.users || [])].map(u => u.username)})
    return {author: m.author, id: Number(m.id) || 0, reactions, text: bodyOf(m).trim(), type: m.type}
  `)
// A sent message's id, once the service has given it one. Bound: 10.
export const messageIDAt = async (ordinal: number) =>
  waitFor('the message id', async () => (await storedMessage(ordinal))?.id || undefined, {interval: 250, timeout: 10_000})

// A loaded attachment as the store holds it: how the thread draws it ('attachment:image',
// 'attachment:video', 'attachment:file', ...), whether its preview has a url, whether it is shown
// collapsed, and the transfer under way, if any. Null for a message that is not an attachment.
export type StoredAttachment = {
  author: string
  collapsed: boolean
  hasPreview: boolean
  id: number
  renderType: string
  title: string
  transferState: string | null
}
export const storedAttachment = async (ordinal: number) =>
  jsEval<StoredAttachment | null>(`${threadStoreBody}
    const m = st && st.messageMap.get(${ordinal})
    if (!m || m.type !== 'attachment') return null
    return {
      author: m.author,
      collapsed: !!m.isCollapsed,
      hasPreview: !!m.previewURL,
      id: Number(m.id) || 0,
      renderType: String(st.messageTypeMap.get(${ordinal}) || ''),
      title: m.title || '',
      transferState: m.transferState || null,
    }
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
const composerTop = async () => {
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

// Waits until three readings 300ms apart (600ms in all) agree with the first of them, and returns
// the last: two close readings can both land inside one held frame of an animation.
export const waitForThreadStable = async (timeout = 10_000) => {
  const end = Date.now() + timeout
  let run: Array<ThreadReading> = []
  for (;;) {
    const t = await readThread()
    run = t && run[0] && sameReading(run[0], t) ? [...run, t] : t ? [t] : []
    if (t && run.length >= 3) return t
    if (Date.now() > end) {
      throw new Error(`the thread did not settle within ${timeout}ms (last offset ${t?.offset}, ${t?.rows.length} rows)`)
    }
    await sleep(300)
  }
}

// At the end: holding the newest message (nothing newer to load), resting at the offset the list
// keeps its newest row above the composer from, with that row in view.
const endGapMax = 40
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

// The conversation the visible screen shows once a chat thread is pushed, or undefined before then.
const openedConversation = async () => {
  const {screen} = await appSnapshot()
  const id = screen?.name === 'chatConversation' ? screen.params?.['conversationIDKey'] : undefined
  return typeof id === 'string' ? id : undefined
}

// Waits for an opened conversation's thread to mount: its composer, the native push, and its list.
const waitForThread = async (convID: string) => {
  await waitForTestID(T.CHAT_INPUT, 15_000)
  // JS names the screen before the native push lands; until it does the tab root still looks current
  await browser.waitUntil(async () => !(await atTabs()), {interval: 150, timeout: 5_000}).catch(() => {})
  await waitFor('the thread list', async () => ((await readThread())?.convID === convID ? true : undefined), {
    interval: 250,
    timeout: 15_000,
  })
}

// Opens a conversation by id through a keybase://convid link (the deep-link path the app itself
// handles), from the chat tab's root, so the thread mounts afresh. Waits for its list to read.
export const openConversation = async (convID: string) => {
  await hideKeyboard()
  await escapeToTabs()
  await navigateToChat()
  openUrl(`keybase://convid/${convID}`)
  await waitFor('the conversation to open', async () => ((await openedConversation()) === convID ? true : undefined), {
    interval: 250,
    timeout: 20_000,
  })
  await waitForThread(convID)
}

// The inbox from its top to its end is ~8 pages on the test account (each drag ~3s, the app settling)
const INBOX_SCROLL_MS = 60_000
// how far inside the band's edges a row must sit to count as in view
const INBOX_MARGIN = 4

// midX: the middle of the element across (the inbox is a column of its own on a tablet)
type Rect = Span & {midX: number}
const rectOf = async (e: WebdriverIO.Element): Promise<Rect> => {
  const {x, y} = await e.getLocation()
  const {height, width} = await e.getSize()
  return {bottom: y + height, midX: Math.round(x + width / 2), top: y}
}

// A slow finger drag on the inbox list, held still before lifting so it does not fling on.
// Positive dy drags the content down (toward the inbox's top).
const dragInbox = async (list: Rect, dy: number) => {
  const x = list.midX
  const room = list.bottom - list.top - 40
  const d = Math.sign(dy) * Math.min(Math.abs(dy), room)
  const mid = (list.top + list.bottom) / 2
  const from = Math.round(mid - d / 2)
  await browser
    .action('pointer', {parameters: {pointerType: 'touch'}})
    .move({x, y: from})
    .down()
    .move({duration: 500, x, y: Math.round(from + d)})
    .pause(300)
    .up()
    .perform()
}

// What the inbox draws now, from one page source (inboxIn): a WebDriver call per element and
// attribute costs ~65ms, which put a whole inbox seek past its bound. Working out `visible` for every
// element is most of a source's cost (~1.5s against ~0.1s on a long inbox), and inboxIn reads none
// of the attributes left out.
const drawnInbox = async () =>
  inboxIn(
    sourceElements(
      await browser.execute<string, [{excludedAttributes: string; format: string}]>('mobile: source', {
        excludedAttributes: 'visible,accessible,enabled,index,traits',
        format: 'xml',
      })
    )
  )

// The element behind a drawn inbox item: the one of its kind at its span.
const elementOfItem = async (item: DrawnInboxItem) => {
  const id = item.kind === 'small' ? T.CHAT_INBOX_ROW : item.kind === 'channel' ? T.CHAT_INBOX_CHANNEL_ROW : T.CHAT_INBOX_BIG_TEAM_HEADER
  for (const e of await browser.$$(`~${id}`).getElements()) {
    const r = await rectOf(e).catch(() => undefined)
    if (r && Math.abs(r.top - item.span.top) < 1 && Math.abs(r.bottom - item.span.bottom) < 1) return e
  }
  throw new Error('the inbox item found moved before it could be tapped')
}

// The chat tab's inbox dragged to its top (until a drag down changes nothing), from the tab root.
// Returns the list's rect and the deadline of the scroll it starts (INBOX_SCROLL_MS).
const inboxAtTop = async () => {
  await hideKeyboard()
  await escapeToTabs()
  await navigateToChat()
  await waitForTestID(T.CHAT_INBOX_LIST, 15_000)
  const list = await rectOf(await el(T.CHAT_INBOX_LIST).getElement())
  const deadline = Date.now() + INBOX_SCROLL_MS
  // iOS scrolls the list to its top on a status bar tap; the drags below confirm it got there (and
  // finish the job if it did not), instead of one drag per page the list was scrolled down
  await tapStatusBar()
  for (let before = await drawnInbox(); ; ) {
    if (Date.now() > deadline) throw new Error(`the inbox did not reach its top in ${INBOX_SCROLL_MS / 1000}s`)
    await dragInbox(list, list.bottom - list.top)
    const now = await drawnInbox()
    if (now.signature === before.signature) return {deadline, drawn: now, list}
    before = now
  }
}

// The chat tab's inbox at its top, where its search placeholder is.
export const scrollInboxToTop = async () => {
  await inboxAtTop()
}

// How many drags in a row must change nothing before the inbox counts as at its end.
const INBOX_END_STILL_DRAGS = 2

// Drags the inbox from its top down until `find` picks a drawn item (its index in the drawing), and
// brings that item wholly into view: inside the list less what floats over it (the unread shortcut,
// the Big teams divider, the tab bar). `find` is handed the team whose section runs above the
// drawing's first header (unknown, no team's, until a header has been seen there). Returns the
// item's element, or undefined once the inbox's end is drawn with nothing picked; fails after
// INBOX_SCROLL_MS. The native inbox draws only the rows near what it shows, hence the drags.
const seekInbox = async (
  find: (items: ReadonlyArray<DrawnInboxItem>, carried: string | undefined) => number | undefined | Promise<number | undefined>
): Promise<WebdriverIO.Element | undefined> => {
  const started = Date.now()
  const top = await inboxAtTop()
  const {deadline, list} = top
  let drawn = top.drawn
  const atTop = Date.now() - started
  const page = list.bottom - list.top
  let carried: string | undefined
  // geometry only, for the timeout's error: never a row's label
  let passes = 0
  let last = 'not drawn'
  // drags in a row that changed nothing, paging on and bringing a found item into view
  let still = 0
  let stillShifts = 0
  for (;;) {
    if (Date.now() > deadline) {
      const where = `list ${Math.round(list.top)}..${Math.round(list.bottom)}, ${passes} passes after ${atTop}ms to reach the top, last: ${last}`
      throw new Error(`the inbox item asked for is not in view after ${INBOX_SCROLL_MS / 1000}s of scrolling (${where})`)
    }
    passes++
    const at = await find(drawn.items, carried)
    // every drag below moves the content, so the section at the top is read off this drawing first
    carried = carriedTeam(drawn.items, list.top, carried)
    if (at !== undefined) {
      const band = visibleBand(list, drawn.covers)
      const span = drawn.items[at]!.span
      last = `drawn at ${Math.round(span.top)}..${Math.round(span.bottom)}, band ${Math.round(band.top)}..${Math.round(band.bottom)}`
      if (whollyInBand(span, band, INBOX_MARGIN)) return elementOfItem(drawn.items[at]!)
      // drawn but not wholly in view: bring it into the band
      await dragInbox(list, shiftIntoBand(span, band, INBOX_MARGIN))
      const shifted = await drawnInbox()
      // as at the end: one still drag may be a tap or a settling list, two in a row cannot move it
      stillShifts = shifted.signature === drawn.signature ? stillShifts + 1 : 0
      if (stillShifts >= INBOX_END_STILL_DRAGS) {
        throw new Error(`the inbox item asked for cannot be brought wholly into view: ${stillShifts} drags to move it changed nothing (${last})`)
      }
      drawn = shifted
      continue
    }
    await dragInbox(list, -page)
    // the drawing after the drag is the next pass's: one page source a pass
    const next = await drawnInbox()
    // A drag that changed nothing is the end only when the next one changes nothing too: a drag
    // taken as a tap, or one while the list still settles, also leaves the drawing as it was.
    still = next.signature === drawn.signature ? still + 1 : 0
    if (still >= INBOX_END_STILL_DRAGS) return undefined
    drawn = next
  }
}

// The frames an eval's e2eMeasure(key, hosts) puts at globalThis[key], in its hosts' order, once
// every one is measured. Bound: 3.
const measured = async (key: string, what: string) =>
  waitFor(what, async () => (await jsEval<Array<Frame> | null>(`return globalThis[${JSON.stringify(key)}] || null`)) ?? undefined, {
    interval: 100,
    timeout: 3_000,
  })

// The app's drawn small conversation rows (AppSmallRow): each row's tappable box measured, and its
// top line's participants and team. Bound: the read 1, the measures 3.
const appSmallRows = async (): Promise<Array<AppSmallRow>> => {
  const lines = await jsEval<Array<{participants: Array<string>; team: boolean}>>(
    `${fiberPrelude}
    const boxes = []
    const stack = [e2eRootFiber()]
    while (stack.length) {
      const f = stack.pop()
      if (f.tag !== 5 && f.memoizedProps && f.memoizedProps.testID === ${JSON.stringify(T.CHAT_INBOX_ROW)}) boxes.push(f)
      else if (f.child) stack.push(f.child)
      if (f.sibling) stack.push(f.sibling)
    }
    const rows = []
    for (const box of boxes) {
      let line
      const inner = box.child ? [box.child] : []
      while (inner.length && !line) {
        const f = inner.pop()
        const p = f.memoizedProps
        if (p && Array.isArray(p.participants) && 'teamDisplayName' in p) line = p
        if (f.sibling) inner.push(f.sibling)
        if (f.child) inner.push(f.child)
      }
      const host = e2eHostOf(box)
      if (line && host) rows.push({host, participants: [...line.participants], team: !!line.teamDisplayName})
    }
    e2eMeasure('__e2eSmallRows', rows.map(r => r.host))
    return rows.map(r => ({participants: r.participants, team: r.team}))
  `,
    {once: true}
  )
  const frames = await measured('__e2eSmallRows', `the ${lines.length} inbox rows measured`)
  return lines.map((l, i) => ({...l, bottom: frames[i]!.y + frames[i]!.height, top: frames[i]!.y}))
}

// The drawn row named `name` in this drawing (findInboxRow). A small conversation's must also be the
// app's one-on-one row with `name` (isOneOnOneRow), read only once a label matched: a group whose
// first participant is `name` reads the same.
const inboxRowNamed = async (items: ReadonlyArray<DrawnInboxItem>, name: string, team: string, carried: string | undefined) => {
  if (name.startsWith('#') || !inboxRowCandidates(items, name, team, carried).length) return findInboxRow(items, name, team, carried)
  return findInboxRow(items, name, team, carried, isOneOnOneRow(await appSmallRows(), name))
}

// The inbox row of the conversation named `name`, wholly in view: a small conversation by its name
// (a one-on-one row only, inboxRowNamed), a channel as "#channel" and only among KB_E2E_TEAM's
// channels (findInboxRow; a name more than one drawn row matches is refused). Fails at the inbox's end
// or after INBOX_SCROLL_MS. Its errors name neither `name` nor any row: the inbox holds conversations
// other than the test ones.
export const scrollInboxTo = async (name: string): Promise<WebdriverIO.Element> => {
  const {team} = loadE2EAccounts()
  const row = await seekInbox(async (items, carried) => inboxRowNamed(items, name, team, carried))
  if (!row) throw new Error('the inbox row asked for is not in the inbox (scrolled to its end)')
  return row
}

// Whether the inbox draws a row of the conversation named `name` (as scrollInboxTo finds it) anywhere
// from its top to its end. false needs the whole inbox scrolled, so a caller checks a row it expects
// is there first, which shows the inbox loaded, and pairs it with appInboxLists.
export const inboxHasRow = async (name: string) => {
  const {team} = loadE2EAccounts()
  return (await seekInbox(async (items, carried) => inboxRowNamed(items, name, team, carried))) !== undefined
}

// The gear of the big team header of `team`, by its exact name (findInboxHeader), wholly in view.
export const scrollInboxToTeamHeader = async (team: string): Promise<WebdriverIO.Element> => {
  const gear = await seekInbox(items => findInboxHeader(items, team))
  if (!gear) throw new Error('the team header asked for is not in the inbox (scrolled to its end)')
  return gear
}

// Opens the conversation named `name` by tapping its inbox row (scrollInboxTo), and waits for its
// thread. Returns its conversation id.
export const openFromInbox = async (name: string) => {
  for (let tap = 1; ; tap++) {
    const row = await scrollInboxTo(name)
    await row.click()
    // a tap the list takes as the end of a scroll opens nothing; tap again
    const convID = await waitFor('the conversation of the tapped inbox row to open', openedConversation, {
      interval: 250,
      timeout: 5_000,
    }).catch((e: unknown) => {
      if (tap >= 3) throw e
      return undefined
    })
    if (convID) {
      await waitForThread(convID)
      return convID
    }
  }
}

// Whether what a flow changed survives a relaunch of the app: relaunches it (a new JS runtime, the
// recording checkpointed on both sides) and waits for it to sign in, then `read`, which goes back to
// where the value shows and reads it, and checks it equals `want`. It proves the change persisted
// only when `want` differs from what the app shows by default: the caller picks a non-default value.
// Bound: relaunchApp 200, waitSignedIn 90, then `read`'s own.
export const expectPersists = async <V,>(what: string, read: () => Promise<V>, want: V) => {
  await relaunchApp()
  await waitSignedIn()
  const miss = persistedMismatch(what, await read(), want)
  if (miss) throw new Error(miss)
}

// -- notification settings (the info panel's Settings tab) --------------------------------------

const NOTIFY_LABELS = {never: 'Never', onAnyActivity: 'On any activity', onWhenAtMentioned: 'Only when @mentioned'} as const
type NotifyGroup = 'desktop' | 'mobile'
export type NotifyChoice = keyof typeof NOTIFY_LABELS

// the full-width box around one choice's radio, chosen or not
export const notifyRadioBox = (group: NotifyGroup, choice: NotifyChoice) =>
  browser.$(`-ios predicate string:name BEGINSWITH "${T.CHAT_NOTIFY_RADIO_PREFIX}${group}-${choice}"`)

// Taps a notification choice's radio: its own clickable (the circle and its label) inside the box,
// since the box runs the panel's width and its middle can fall past the label. The tree shows the
// clickable as the box's sibling, inside the box's frame, not as its child. Bound: the box 10, the
// clickable 10, the tap 1 = 21s.
export const tapNotifyRadio = async (group: NotifyGroup, choice: NotifyChoice) => {
  const box = notifyRadioBox(group, choice)
  await box.waitForExist({interval: 150, timeout: 10_000, timeoutMsg: `the ${group} "${NOTIFY_LABELS[choice]}" radio never appeared`})
  const radio = await waitFor(
    `the clickable in the ${group} "${NOTIFY_LABELS[choice]}" radio's box`,
    async () => {
      const {x, y} = await box.getLocation()
      const {height, width} = await box.getSize()
      // the clickable and its label's text (reported twice) both lie in the box: the innermost counts
      const inBox: Array<{e: WebdriverIO.Element; rect: {height: number; width: number; x: number; y: number}}> = []
      const seen: Array<string> = []
      for (const e of await browser.$$(`-ios predicate string:label == "${NOTIFY_LABELS[choice]}" AND visible == 1`).getElements()) {
        const at = await e.getLocation().catch(() => undefined)
        const size = await e.getSize().catch(() => undefined)
        if (!at || !size) continue
        const mx = at.x + size.width / 2
        const my = at.y + size.height / 2
        seen.push(`${Math.round(mx)},${Math.round(my)}`)
        if (mx >= x && mx <= x + width && my >= y && my <= y + height) inBox.push({e, rect: {...at, ...size}})
      }
      const inside = innermost(inBox.map(c => c.rect)).map(i => inBox[i]!.e)
      if (inside.length === 1) return inside[0]
      // geometry only, for the timeout's message
      throw new Error(`${inside.length} in the box at ${x},${y} ${width}x${height}; middles seen: ${seen.join(' ') || 'none'}`)
    },
    // one pass reads the box and both groups' choices, several calls each, slower while recording
    {interval: 150, timeout: 10_000}
  )
  await radio.click()
}

// The chosen notification choice of a group, read off its radios' testIDs; undefined while none shows.
export const notifyRadioChosen = async (group: NotifyGroup): Promise<NotifyChoice | undefined> => {
  const prefix = `${T.CHAT_NOTIFY_RADIO_PREFIX}${group}-`
  const chosen = browser.$(
    `-ios predicate string:name BEGINSWITH "${prefix}" AND name ENDSWITH "${T.CHAT_NOTIFY_RADIO_SELECTED_SUFFIX}"`
  )
  if (!(await chosen.isExisting())) return undefined
  const id = (await chosen.getAttribute('name')) ?? ''
  const choice = id.slice(prefix.length, id.length - T.CHAT_NOTIFY_RADIO_SELECTED_SUFFIX.length)
  return choice in NOTIFY_LABELS ? (choice as NotifyChoice) : undefined
}

// -- accounts -----------------------------------------------------------------------------------

export const signedInAs = async () => jsEval<AppAccount>(APP_ACCOUNT_BODY)

// Waits for the app, just relaunched, to be signed in with no account switch under way. Bound: 90.
export const waitSignedIn = async () =>
  waitFor(
    'the relaunched app to sign in',
    async () => {
      const a = await signedInAs().catch(() => undefined)
      return a?.loggedIn && !a.switching ? true : undefined
    },
    {interval: 250, timeout: 90_000}
  )

// Opens the account switcher sheet from the chat tab's avatar.
export const openAccountSwitcher = async () => {
  await escapeToTabs()
  await navigateToChat()
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
}

// Switches the app to another account signed in on this device, through the account switcher the
// chat tab's avatar opens, and waits for the switch to finish.
export const switchAppAccount = async (username: string) => {
  const now = await signedInAs()
  if (now.loggedIn && !now.switching && now.username === username) return
  await openAccountSwitcher()
  const row = el(T.ACCOUNT_SWITCHER_ROW_PREFIX + username)
  await waitFor(
    'the account switch',
    async () => {
      const a = await signedInAs().catch(() => undefined)
      if (a && a.loggedIn && !a.switching && a.username === username) return true
      // the sheet ignores a tap while it is still sliding in; tap again until the switch starts
      if (a && !a.switching && (await byText('Log in as another user').isExisting()) && (await row.isExisting().catch(() => false))) {
        await row.click().catch(() => {})
      }
      return undefined
    },
    {interval: 1_000, timeout: 60_000}
  )
  await escapeToTabs()
}

// -- composer ------------------------------------------------------------------------------------

// The composer's text, read from the input element.
export const composerText = async () => fieldText(el(T.CHAT_INPUT))

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

// Bound: clearFieldByKeys 16, the composer read empty 5 = 21s.
export const clearComposer = async () => {
  await clearFieldByKeys(el(T.CHAT_INPUT))
  await waitForComposerText('')
}

// Ends whatever the open conversation's composer holds (an edit, a reply, text), which saves an
// empty draft; nothing where the conversation draws no composer. Cleanup only: it does what the
// composer needs, whatever a test left. Bound: the composer read 5, the edit bar 5 and its wait 5,
// the reply bar 5 and its wait 5, clear 21 = 46.
export const resetComposer = async () => {
  if (!(await el(T.CHAT_INPUT).isExisting())) return
  if (await editCancel().isExisting()) await editCancel().click()
  if (await replyPreview().isExisting()) await el(T.CHAT_REPLY_CANCEL).click()
  await editCancel().waitForExist({reverse: true, timeout: 5_000})
  await replyPreview().waitForExist({reverse: true, timeout: 5_000})
  await clearComposer()
}

// The open suggestion list's rows, each with the words of its label (a row's label merges what it
// shows); the highlighted one carries its own testID. A user row holds an account name, so callers
// pick rows by their words in memory.
export const suggestionRows = async () => {
  const found = [...(await els(T.CHAT_SUGGESTION_ROW).getElements()), ...(await els(T.CHAT_SUGGESTION_ROW_SELECTED).getElements())]
  return Promise.all(found.map(async e => ({e, words: ((await e.getAttribute('label')) ?? '').split(/[ ,]+/).filter(w => !!w)})))
}

// Sends `text` through the composer's send button and returns the ordinal of its row.
// A Send tap right after the typing has now and then not taken: the text stayed in the composer and
// nothing was sent. Send is tapped a second time only when the first sent nothing (no row with the
// text, the composer not emptied), read again right before the second tap since the first can land
// after its 3s of reads, so nothing is sent twice. Bound 25: the typing 5, the button 5, the first
// tap (the tap 1, 3s of reads) 4, the second (a read 1, the tap 1, 3s of reads) 5, the row 6.
export const sendMessage = async (text: string) => {
  await typeInComposer(text)
  await waitForTestID(T.CHAT_SEND_BUTTON, 5_000)
  const took = async () => (await ordinalsWithText(text)).length > 0 || (await composerText()) === ''
  for (let i = 0; ; i++) {
    if (i > 0 && (await took())) break
    await el(T.CHAT_SEND_BUTTON).click()
    const sent = await waitFor('the send to take', async () => ((await took()) ? true : undefined), {interval: 250, timeout: 3_000}).catch(
      (e: unknown) => {
        if (isAttemptOver(e)) throw e
        return false
      }
    )
    if (sent) break
    if (i === 1) throw new Error('two taps on Send sent nothing: the text is still in the composer')
    console.log('sendMessage: the first Send tap sent nothing; tapping it again')
  }
  return waitForRow(text, 6_000)
}

export const isKeyboardUp = async () => browser.isKeyboardShown().catch(() => false)

// Waits for the keyboard to be up as the app sees it: WDA reports it as soon as an input takes focus,
// while RN's Keyboard.metrics() (what the thread's keyboardTop reads) is set only once it has shown.
export const waitForKeyboard = async (timeout = 5_000) =>
  waitFor(
    'the keyboard',
    async () =>
      (await isKeyboardUp()) &&
      (await jsEval<boolean>(`const m = kbModule('node_modules/react-native/index.js').Keyboard.metrics(); return !!m && m.height > 0`))
        ? true
        : undefined,
    {interval: 200, timeout}
  )

// Closes the keyboard the way the app does (WDA's own hideKeyboard cannot find a way to close this
// app's keyboards), and waits for it to go.
// The keyboard counts as up when either WDA or the app says so: WDA's isKeyboardShown has read false
// with the keyboard drawn, and then a hide that trusted it alone did nothing.
const appKeyboardUp = async () =>
  jsEval<boolean>(`const m = kbModule('node_modules/react-native/index.js').Keyboard.metrics(); return !!m && m.height > 0`)
const eitherSaysUp = async () => (await isKeyboardUp()) || (await appKeyboardUp())

// Bound: 5s, a hard deadline (no step starts after it): its reads are evals, each of which can take
// 10s or more on a slow inspector.
export const hideKeyboard = async () =>
  underDeadline('hiding the keyboard', 5_000, async alive => {
    if (!(await eitherSaysUp())) return
    alive()
    await jsEval(`kbModule('node_modules/react-native/index.js').Keyboard.dismiss(); return true`, {once: true})
    await waitFor('the keyboard to close', async () => ((await eitherSaysUp()) ? undefined : true), {interval: 200, timeout: 5_000})
  })

// -- a message's menu ----------------------------------------------------------------------------

// Long-presses the message showing `text` (at its middle, found afresh each try) to open its menu,
// a bottom sheet, and waits for the sheet.
export const openMessageMenu = async (text: string) => {
  await openSheetWith(`the menu of the message "${text}"`, async () => {
    const {x, y} = await rowCentre(text)
    await browser.execute('mobile: touchAndHold', {duration: 0.8, x, y})
  })
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

// The frames of the open menu sheets (openSheets), read again once when none gives one (a sheet
// re-rendering after a drag can fail its frame read); throws when the second read gives none either,
// as a sheet with no measured top has no backdrop to tap. Bound: two reads 4.
const openSheetFrames = async () => {
  for (let read = 1; ; read++) {
    const frames: Array<Frame> = []
    for (const sh of await browser.$$(await openSheets()).getElements()) {
      const r = await frameOf(sh)
      if (r) frames.push(r)
    }
    if (frames.length) return frames
    if (read >= 2) throw new Error('the open menu sheet gives no frame: not tapping')
  }
}

// The window's safe-area top: the status bar's height, as WDA reports it. Bound: 1.
const safeAreaTop = async () => {
  const info = await browser.execute('mobile: deviceScreenInfo')
  const h = (info as {statusBarSize?: {height?: number}} | undefined)?.statusBarSize?.height
  if (typeof h !== 'number' || !(h > 0)) throw new Error('no status bar height from the device: not tapping')
  return h
}

// Closes the open message menu with the sheet's own Close (one lying wholly on screen and inside a
// measured open sheet), else with a tap on the backdrop above the sheet's top, at the middle of the
// band below the safe-area top, when at least BACKDROP_MIN of that band shows. It never taps anywhere
// else below the sheet's top: a sheet's first row is its quick reactions, where a tap writes. With neither, the sheet is dragged down by its top
// edge (which lowers it or closes it) and read again, up to twice; then it fails. Bound: 19, a hard
// deadline (no tap or drag starts after it): three rounds of reads (the window, the sheets read once
// more when they give no frame, the Closes), two drags and their settles, the tap, the sheet gone 5.
const BACKDROP_MIN = 44
const CLOSE_MS = 19_000
export const closeMessageMenu = async () =>
  underDeadline('closing the message menu', CLOSE_MS, async alive => {
    if (!(await (await menuSheet()).isExisting())) return
    for (let drags = 0; ; drags++) {
      if (!(await (await menuSheet()).isExisting())) break
      const {height, width} = await browser.getWindowRect()
      const sheets = await openSheetFrames()
      const top = Math.min(...sheets.map(r => r.y))
      let close: {x: number; y: number} | undefined
      for (const c of await browser.$$('-ios predicate string:type == "XCUIElementTypeOther" AND (label == "Close" OR label ENDSWITH ", Close")').getElements()) {
        const r = await frameOf(c)
        // the sheet's own Close: inside a measured open sheet and wholly on screen
        if (r && sheets.some(sh => frameInside(r, sh)) && frameInside(r, {height, width, x: 0, y: 0})) close = {x: r.x + r.width / 2, y: r.y + r.height / 2}
      }
      if (!close) {
        // the backdrop band between the safe-area top (the status bar, where a tap may not reach the
        // app) and the sheet's top
        const safeTop = await safeAreaTop()
        if (top - safeTop >= BACKDROP_MIN) close = {x: width / 2, y: (safeTop + top) / 2}
      }
      if (close) {
        alive()
        await browser.execute('mobile: tap', {x: Math.round(close.x), y: Math.round(close.y)})
        break
      }
      if (drags >= 2) throw new Error('the menu sheet shows no Close on screen and too little backdrop above it: not tapping inside the sheet')
      alive()
      await browser
        .action('pointer', {parameters: {pointerType: 'touch'}})
        .move({x: Math.round(width / 2), y: Math.round(top + 8)})
        .down()
        .move({duration: 300, x: Math.round(width / 2), y: Math.round(Math.min(height - 40, top + 400))})
        .up()
        .perform()
      await browser.pause(1_000)
    }
    await waitForSheetGone(5_000)
  })

// The conversations whose inbox row menu the app draws now (a small row's menu: the one with its pin
// items), read off the React tree.
const inboxRowMenuConversations = async () =>
  jsEval<Array<string>>(`${fiberPrelude}
    const out = new Set()
    const stack = [e2eRootFiber()]
    while (stack.length) {
      const f = stack.pop()
      const p = f.memoizedProps
      if (p && p.showPinItems === true && p.visible === true && typeof p.onHidden === 'function' && typeof p.conversationIDKey === 'string') {
        out.add(p.conversationIDKey)
      }
      if (f.sibling) stack.push(f.sibling)
      if (f.child) stack.push(f.child)
    }
    return [...out]
  `)

const ROW_MENU_PRESSES = 3

// Long-presses the inbox row of the conversation named `name` to open its menu, a bottom sheet of
// the conversation's actions, finding the row afresh (scrollInboxTo) for each press. The sheet must
// be the menu of `convID`, the conversation the caller means: any other is closed and refused, so
// no item of it is ever tapped. Bound: an open sheet closed 19, three presses of scrollInboxTo 90,
// the press 1 and the sheet 3, the menu's read 1 and its close 19 = 323.
export const openInboxRowMenu = async (name: string, convID: string) => {
  await closeMessageMenu()
  for (let press = 1; ; press++) {
    const row = await scrollInboxTo(name)
    await browser.execute('mobile: touchAndHold', {duration: 0.8, elementId: row.elementId})
    if (await (await menuSheet()).waitForExist({interval: 150, timeout: 3_000}).catch(() => false)) break
    if (press >= ROW_MENU_PRESSES) throw new Error(`the inbox row menu did not open after ${ROW_MENU_PRESSES} long presses`)
  }
  const shown = await inboxRowMenuConversations()
  if (shown.length !== 1 || shown[0] !== convID) {
    await closeMessageMenu()
    throw new Error(`the inbox row menu open is not the asked-for conversation's (${shown.length} row menus drawn)`)
  }
}

// -- search filters ------------------------------------------------------------------------------

// The search filter on screen (common-adapters/search-filter.tsx: the inbox filter, the forward,
// channel, member and bot pickers). Its box is one accessible element on iOS, so the text field in it
// is not in the tree: its text goes in through the focused field.
export const searchFilter = () => browser.$(`-ios predicate string:name == "${T.SEARCH_FILTER}" AND visible == 1`)

// Types `text` into whatever input has the keyboard's focus, as key presses (WDA types them through
// the keyboard). The error says what was typed into, never the text: it can hold an account name.
export const typeIntoFocused = async (what: string, text: string) => {
  const actions = [...text].flatMap(c => [
    {type: 'keyDown', value: c},
    {type: 'keyUp', value: c},
  ])
  try {
    await browser.performActions([{actions, id: 'keyboard', type: 'key'}])
  } catch (e) {
    if (isAttemptOver(e)) throw e
    // the cause would carry the text
    // eslint-disable-next-line preserve-caught-error
    throw new Error(`typing into ${what} failed`)
  } finally {
    await browser.releaseActions().catch(() => {})
  }
}

// Focuses the search filter on screen (a tap on its box, unless the keyboard is already up) and
// types `text` into it. Bound: the filter 10, the tap 1, the keyboard 5, the keys 5 = 21s.
export const typeInSearchFilter = async (text: string) => {
  const filter = searchFilter()
  await filter.waitForExist({timeout: 10_000})
  if (!(await isKeyboardUp())) await filter.click()
  await waitFor('the keyboard', async () => ((await isKeyboardUp()) ? true : undefined), {timeout: 5_000})
  await typeIntoFocused('the search filter', text)
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
// Each tap waits for its effect before the next: the menu closes as soon as its item is tapped but
// what it opens can take longer to show, and a More tapped in that gap reopens the menu over it (seen
// live: thread search open under the header menu). Bound: 15s.
export const openHeaderMenuItem = async (item: string, opened: () => Promise<boolean>) => {
  await hideKeyboard()
  const settle = async (what: string, done: () => Promise<boolean>) =>
    waitFor(what, async () => ((await done()) ? true : undefined), {interval: 250, timeout: 3_000}).catch((e: unknown) => {
      if (isAttemptOver(e)) throw e
    })
  await waitFor(
    `${item} to open from the header menu`,
    async () => {
      if (await opened()) return true
      if (await headerMenuItem(item).isExisting()) {
        await headerMenuItem(item).click().catch(() => {})
        await settle(`${item} to open`, opened)
      } else {
        await browser.$('~More').click().catch(() => {})
        await settle('the header menu', async () => (await opened()) || (await headerMenuItem(item).isExisting()))
      }
      return undefined
    },
    {interval: 250, timeout: 15_000}
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
  jsEval<string | null>(`${fiberPrelude}
    const stack = [e2eRootFiber()]
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
    await clearFieldByKeys(input)
    await input.addValue(query)
    // Only not holding the query yet is waited out (and the query typed again); any other failure
    // (a lost session, the eval itself) is thrown. The wait ends with the overall deadline.
    const holdEnd = Math.min(Date.now() + 10_000, end)
    let held = await searchBarText()
    while (held !== query && Date.now() < holdEnd) {
      await sleep(100)
      held = await searchBarText()
    }
    if (held !== query) {
      if (Date.now() > end) throw new Error(`the search bar holds ${JSON.stringify(held)}, not "${query}"`)
      console.log(`the search bar holds ${JSON.stringify(held)} after typing "${query}"; typing it again`)
      continue
    }
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

// A tap can only put the keyboard away (seen live after a drag): Cancel is tapped again while the
// search bar and its Cancel are both still up. Bound: two tries of the tap and 2.5s = 5s.
export const closeSearch = async () => {
  const cancel = browser.$('-ios predicate string:type == "XCUIElementTypeStaticText" AND label == "Cancel" AND visible == 1')
  for (let tap = 1; ; tap++) {
    await cancel.click()
    const closed = await el(T.CHAT_THREAD_SEARCH)
      .waitForExist({reverse: true, timeout: 2_500})
      .then(() => true)
      .catch(() => false)
    if (closed) return
    if (tap >= 2 || !(await cancel.isExisting())) throw new Error('thread search is still open after its Cancel was tapped')
  }
}

export const searchOpen = async () => el(T.CHAT_THREAD_SEARCH).isExisting()

// -- misc --------------------------------------------------------------------------------------

export const jumpToRecentButton = () => el(T.CHAT_JUMP_TO_RECENT)
export const catchUpPill = () => el(T.CHAT_CATCH_UP)
export const replyPreview = () => el(T.CHAT_REPLY_PREVIEW)
export const pinnedBanner = () => el(T.CHAT_PINNED_BANNER)
export const editCancel = () => el(T.CHAT_EDIT_CANCEL)

// -- assertions ----------------------------------------------------------------------------------

// Waits for the thread to settle and checks it rests at its end.
// A still reading can land mid-animation: the list follows a new message with an animated scroll of
// about 250ms, and a JS thread busy loading pages can hold a frame of it for longer than the 600ms
// the settling readings span (a reading 20.7 points short matched one frame of that animation). So a reading
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

// The one element `selector` matches whose middle lies inside the thread row at `ordinal` (the tree
// is flattened, so what a row draws are elements placed inside the rect the list measured for it).
// Throws when the row is not drawn, or when none or more than one match; `what` names the element.
export const elementInRow = async (selector: string, ordinal: number, what: string) => {
  const r = rowOf(await requireThread(), ordinal)
  if (!r) throw new Error(`row ${ordinal} is not drawn, so ${what} in it cannot be found`)
  // RN text is often reported as nested nodes (a StaticText in a StaticText, in a labelled box), so
  // of the matches that nest or share a frame, only the innermost counts
  const found: Array<{e: WebdriverIO.Element; rect: {height: number; width: number; x: number; y: number}}> = []
  for (const e of await browser.$$(selector).getElements()) {
    const at = await e.getLocation().catch(() => undefined)
    const size = await e.getSize().catch(() => undefined)
    if (at && size) found.push({e, rect: {...at, ...size}})
  }
  const mids: Array<number> = []
  const inside: Array<WebdriverIO.Element> = []
  for (const i of innermost(found.map(f => f.rect))) {
    const {e, rect} = found[i]!
    const mid = rect.y + rect.height / 2
    mids.push(Math.round(mid))
    if (mid >= r.top && mid <= r.bottom) inside.push(e)
  }
  if (inside.length !== 1) {
    const span = `${Math.round(r.top)}..${Math.round(r.bottom)}`
    throw new Error(`${inside.length} of ${what} in row ${ordinal} (${span}), not one; candidates' middles: ${mids.join(', ') || 'none'}`)
  }
  return inside[0]!
}

// The corner fullscreen button of the video at `ordinal`, titled `title`, in a row wholly in view.
// The poster is a Pressable, which iOS accessibility makes one element, so the button on the poster
// is not in the tree; a tap on the row plays the video inline, where the button is its own element.
// Bound: the row 2, the tap 1, the button 10 and its read 2 = 15s.
export const videoFullscreenButton = async (title: string, ordinal: number) => {
  const row = await elementInRow(
    `-ios predicate string:type == "XCUIElementTypeOther" AND label CONTAINS ", ${title}, "`,
    ordinal,
    'the video row'
  )
  await row.click()
  await waitFor(
    "the video's fullscreen button",
    async () => ((await browser.$$(`~${T.CHAT_VIDEO_FULLSCREEN}`).length) > 0 ? true : undefined),
    {interval: 500, timeout: 10_000}
  )
  return elementInRow(`~${T.CHAT_VIDEO_FULLSCREEN}`, ordinal, "the video's fullscreen button")
}

// Closes the conversation's info panel, a modal sheet, with its header's Done (a back swipe from the
// left edge does not close a sheet), and waits for it to go. Bound: 3 tries of the tap and 5s = 16s.
export const closeInfoPanel = async () => {
  const done = '-ios predicate string:type == "XCUIElementTypeButton" AND label == "Done" AND visible == 1'
  for (let i = 0; i < 3; i++) {
    if (!(await el(T.CHAT_INFO_PANEL).isExisting())) return
    await browser.$(done).click().catch(() => {})
    const gone = await el(T.CHAT_INFO_PANEL)
      .waitForExist({reverse: true, timeout: 5_000})
      .then(() => true)
      .catch(() => false)
    if (gone) return
  }
  throw new Error('the info panel did not close from its Done button')
}

// Drags the thread until the loaded row at `ordinal` sits wholly in the reader's view, and returns
// that reading. Fails when the row is not loaded, or after `timeout`.
export const scrollRowIntoView = async (ordinal: number, timeout = 30_000) =>
  waitFor(
    `row ${ordinal} wholly in view`,
    async () => {
      const t = await waitForThreadStable()
      if (!t.ordinals.includes(ordinal)) throw new Error(`row ${ordinal} is not loaded`)
      const v = await viewport(t)
      const r = rowOf(t, ordinal)
      if (wholly(r, v)) return t
      // positive drags bring older rows (above) down into view
      const dy = r ? (r.top < v.top ? v.top - r.top + 20 : v.bottom - r.bottom - 20) : ordinal < (t.rows[0]?.ordinal ?? 0) ? 300 : -300
      await dragThread(dy)
      return undefined
    },
    {interval: 0, timeout}
  )

// What the info panel's attachments tab lists now, read off its rows' props: the Media grid's
// thumbnails (message id, and whether the thumb is a video's) and the Docs list's rows (message id
// and the name it shows).
type GalleryListing = {docs: Array<{id: number; name: string}>; media: Array<{id: number; video: boolean}>}
export const galleryListing = async () =>
  jsEval<GalleryListing>(`${fiberPrelude}
    const media = []
    const docs = []
    const stack = [e2eRootFiber()]
    while (stack.length) {
      const f = stack.pop()
      const p = f.memoizedProps
      // a media thumb's props hold its thumb and sizing; a doc row's its item of type doc
      if (p && p.thumb && p.sizing && typeof p.thumb.id === 'number' && typeof p.thumb.typ === 'number') {
        media.push({id: p.thumb.id, video: p.thumb.typ === 1})
      } else if (p && p.item && p.item.type === 'doc' && p.item.message && typeof p.item.name === 'string') {
        docs.push({id: Number(p.item.message.id) || 0, name: p.item.name})
      }
      if (f.sibling) stack.push(f.sibling)
      if (f.child) stack.push(f.child)
    }
    const once = (xs, key) => xs.filter((x, i) => xs.findIndex(y => key(y) === key(x)) === i)
    return {docs: once(docs, d => d.id), media: once(media, m => m.id)}
  `)

// Where a message is in its delete: shown, shown while its delete is in flight, or gone from a thread
// that is mounted. Throws while no thread is mounted.
export type DeletePhase = 'gone' | 'row' | 'row+deleting'
export const deletePhase = async (ordinal: number) =>
  jsEval<DeletePhase>(`${threadStoreBody}
    e2eRequireThreadStore()
    if (!(st.messageOrdinals || []).includes(${ordinal})) return 'gone'
    return [...st.pendingDeleteMap.values()].includes(${ordinal}) ? 'row+deleting' : 'row'
  `)

// The chat badge's unread count for a conversation. A 0 does not prove the badge store has loaded
// (right after a relaunch it reads 0 before it has), so after a relaunch only presence checks rely on it.
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

// Taps the pressable text rendering exactly `text` in the message at `ordinal` at its own frame.
// XCUITest can report such a text with its line's full width (the "Collapsed" label of a collapsed
// attachment: 0..402 while the word sits at the left), so a tap on the element's middle lands beside
// the word and does nothing (seen live). The app's tree finds exactly one text with that handler in
// the message, its own view is measured, and the tap lands at that frame's middle only if the frame
// lies wholly inside `element` (the text's element, so the window is the screen here) and on screen.
// The evals send nothing. Bound: 5s.
export const tapTextIn = async (element: WebdriverIO.Element, ordinal: number, text: string) => {
  const started = await jsEval<number>(`${fiberPrelude}
    const label = ${JSON.stringify(text)}
    const hits = []
    for (const row of e2eMessageFibers(${ordinal})) {
      const inner = row.child ? [row.child] : []
      while (inner.length) {
        const f = inner.pop()
        const p = f.memoizedProps
        if (f.child) inner.push(f.child)
        if (f.sibling) inner.push(f.sibling)
        if (f.tag !== 5 && p && p.children === label && typeof p.onClick === 'function' && !hits.some(h => h.memoizedProps.onClick === p.onClick)) hits.push(f)
      }
    }
    if (hits.length !== 1) return hits.length
    const host = e2eHostOf(hits[0])
    if (!host) return -1
    e2eMeasure('__e2eTextFrame', [host])
    return 1
  `, {once: true})
  if (started !== 1) {
    throw new Error(started === -1 ? `the "${text}" text has no view to measure` : `${started} pressable "${text}" texts in the message at ${ordinal}, not one`)
  }
  const [frame] = await measured('__e2eTextFrame', `the "${text}" text measured`)
  const at = await element.getLocation()
  const size = await element.getSize()
  const {height: window} = await browser.getWindowRect()
  if (!frame || !frameInside(frame, {...at, ...size}, window)) {
    throw new Error(`the "${text}" text is not wholly inside its element on screen: ${JSON.stringify(frame)} in ${JSON.stringify({...at, ...size})}`)
  }
  console.log(`  tapTextIn: "${text}" at ${JSON.stringify(frame)} in its element ${JSON.stringify({...at, ...size})}`)
  await browser.execute('mobile: tap', {x: Math.round(frame.x + frame.width / 2), y: Math.round(frame.y + frame.height / 2)})
}

// Presses the inline pressable text `text` (a link drawn inside a message's text, such as a failed
// send's "Edit or Cancel") of the visible thread's message at `ordinal`. On iOS such a text has no
// accessibility element (the row is one element) and no frame of its own (Fabric draws it inside its
// paragraph as virtual text), so the simulator cannot tap it. Ledger ruling, after the camera and QR
// precedent: the flow calls the handler a tap fires, found in the app's tree under that message
// only, exactly one text rendering exactly `text`; the caller adds a manualEdge so a person checks
// the physical tap. It is the app's own UI handler, so what it sends is credited (no
// withHarnessRpcs).
export const pressInlineText = async (ordinal: number, text: string) => {
  const found = await jsEval<number>(`${fiberPrelude}
    const label = ${JSON.stringify(text)}
    // the composite texts with a click handler rendering exactly the label (the host virtual text
    // under each carries the same handler)
    const hits = []
    for (const row of e2eMessageFibers(${ordinal})) {
      const inner = row.child ? [row.child] : []
      while (inner.length) {
        const f = inner.pop()
        const p = f.memoizedProps
        // from the row's first child, every child and sibling stays inside the row
        if (f.child) inner.push(f.child)
        if (f.sibling) inner.push(f.sibling)
        if (f.tag !== 5 && p && p.children === label && typeof p.onClick === 'function') hits.push(p.onClick)
      }
    }
    if (hits.length === 1) hits[0]()
    return hits.length
  `, {once: true})
  if (found !== 1) throw new Error(`${found} pressable "${text}" texts in the message at ${ordinal}, not one`)
}

// Taps a control inside a tappable row the accessibility tree shows as one element (the row's box
// merges what it holds, so the control has no element of its own): the button labelled exactly
// `control`, or, given `{handlerOf}`, the one component whose onClick is the scope's own prop of that
// name (an avatar whose tap is the scope's onEditIcon). The app's tree finds the one such control
// under the one component whose prop `prop` equals `value`, its native view and that component's own
// view are measured (in the app's window, which for a modal is the sheet, not the screen), the row's
// element places them on screen, and the tap lands at the middle of the control's frame only if it
// lies wholly inside `row` (the row's own element, which must be the measured row's size) and on
// screen (ledger ruling, the shape of the inline-text one for a control with a view). The evals send
// nothing. Bound: 5s.
export const tapControlIn = async (
  row: WebdriverIO.Element,
  scope: {prop: string; value: string},
  control: string | {handlerOf: string}
) => {
  const what = typeof control === 'string' ? `the "${control}" button` : `the control on ${control.handlerOf}`
  const started = await jsEval<number>(`${fiberPrelude}
    const prop = ${JSON.stringify(scope.prop)}
    const value = ${JSON.stringify(scope.value)}
    const control = ${JSON.stringify(control)}
    const read = p => prop.split('.').reduce((v, k) => (v && typeof v === 'object' ? v[k] : undefined), p)
    const scopes = []
    const stack = [e2eRootFiber()]
    while (stack.length) {
      const f = stack.pop()
      if (f.sibling) stack.push(f.sibling)
      if (f.memoizedProps && read(f.memoizedProps) === value) scopes.push(f)
      else if (f.child) stack.push(f.child)
    }
    const buttons = []
    for (const s of scopes) {
      const inner = s.child ? [s.child] : []
      while (inner.length) {
        const f = inner.pop()
        if (f.child) inner.push(f.child)
        if (f.sibling) inner.push(f.sibling)
        const p = f.memoizedProps
        if (f.tag === 5 || !p || typeof p.onClick !== 'function') continue
        const handler = typeof control === 'string' ? undefined : s.memoizedProps[control.handlerOf]
        if (typeof control === 'string' ? p.label === control : p.onClick === handler) buttons.push(f)
      }
    }
    if (buttons.length !== 1 || scopes.length !== 1) return buttons.length === 1 ? -2 : buttons.length
    // a component's own native view: its first host descendant
    const button = e2eHostOf(buttons[0])
    const row = e2eHostOf(scopes[0])
    if (!button || !row) return -1
    // both in the same coordinates (a modal's root view, not the screen); the row's element on screen
    // places them
    e2eMeasure('__e2eControlFrames', [button, row])
    return 1
  `, {once: true})
  if (started !== 1) {
    throw new Error(
      started === -1
        ? `${what} or its row has no view to measure`
        : started === -2
          ? 'more than one component matches the row asked for'
          : `${started} of ${what} in the row asked for, not one`
    )
  }
  const [button, measuredRow] = await measured('__e2eControlFrames', `${what} measured`)
  if (!button || !measuredRow) throw new Error(`${what} or its row was not measured`)
  const at = await row.getLocation()
  const size = await row.getSize()
  // the row's view and its element are the same box: the difference places the button on screen.
  // XCUITest reports the element's box rounded outwards to whole points, so a view with a fractional
  // edge on each side reads up to (but not) 2 points larger.
  if (Math.abs(measuredRow.width - size.width) >= 2 || Math.abs(measuredRow.height - size.height) >= 2) {
    throw new Error(`the row measured ${JSON.stringify(measuredRow)} is not the row element ${JSON.stringify({...at, ...size})}`)
  }
  const frame = {...button, x: button.x + at.x - measuredRow.x, y: button.y + at.y - measuredRow.y}
  const {height: window} = await browser.getWindowRect()
  if (!frameInside(frame, {...at, ...size}, window)) {
    throw new Error(`${what} is not wholly inside its row on screen: ${JSON.stringify(frame)} in ${JSON.stringify({...at, ...size})}`)
  }
  await browser.execute('mobile: tap', {x: Math.round(frame.x + frame.width / 2), y: Math.round(frame.y + frame.height / 2)})
}

// Taps the labelled switch (Kb.Switch, e.g. the block modal's "Block <name>") at its own frame, and
// waits for it to turn. XCUITest's frames for a modal's switches and their labels are not where they
// are drawn (taps there did nothing, seen live), and measureInWindow is in the modal's window, not the
// screen: the switch's view is placed on screen by `anchor`, a button in the same modal whose element
// is on screen (the modal's Finish). The app's tree finds exactly one switch with exactly `label` and
// the buttons labelled `anchorLabel` whose measured size is the anchor element's (one frame); the tap
// lands at the middle of the switch's frame only if it is on screen. The evals send nothing. Returns
// whether it was on before. Bound: 3 measured, the tap 1, the turn 5 = 9s.
export const tapSwitchLabelled = async (label: string, anchor: WebdriverIO.Element, anchorLabel: string) => {
  const switchOn = async () =>
    jsEval<Array<boolean>>(`${fiberPrelude}
      const out = []
      const stack = [e2eRootFiber()]
      while (stack.length) {
        const f = stack.pop()
        const p = f.memoizedProps
        if (f.tag !== 5 && p && p.label === ${JSON.stringify(label)} && typeof p.on === 'boolean' && typeof p.onClick === 'function') out.push(p.on)
        if (f.sibling) stack.push(f.sibling)
        if (f.child) stack.push(f.child)
      }
      return out
    `)
  const started = await jsEval<number>(`${fiberPrelude}
    const label = ${JSON.stringify(label)}
    const anchorLabel = ${JSON.stringify(anchorLabel)}
    const switches = []
    const anchors = []
    const stack = [e2eRootFiber()]
    while (stack.length) {
      const f = stack.pop()
      const p = f.memoizedProps
      // a component and its wrapper carry the same props: one switch is one handler
      if (f.tag !== 5 && p && p.label === label && typeof p.on === 'boolean' && typeof p.onClick === 'function' && !switches.some(s => s.memoizedProps.onClick === p.onClick)) switches.push(f)
      if (f.tag !== 5 && p && p.label === anchorLabel && typeof p.onClick === 'function') anchors.push(f)
      if (f.sibling) stack.push(f.sibling)
      if (f.child) stack.push(f.child)
    }
    if (switches.length !== 1) return switches.length
    // the switch's own tappable box: the component under it carrying its handler
    const sw = switches[0]
    let box
    const inner = [sw.child]
    while (inner.length && !box) {
      const f = inner.shift()
      if (!f) continue
      if (f.tag !== 5 && f.memoizedProps && f.memoizedProps.onClick === sw.memoizedProps.onClick) box = f
      if (f.child) inner.push(f.child)
      if (f.sibling) inner.push(f.sibling)
    }
    const host = box && e2eHostOf(box)
    const anchorHosts = anchors.map(e2eHostOf).filter(Boolean)
    if (!host || !anchorHosts.length) return -1
    // the switch first, then every anchor
    e2eMeasure('__e2eSwitchFrames', [host, ...anchorHosts])
    return 1
  `, {once: true})
  if (started !== 1) {
    throw new Error(started === -1 ? 'the switch asked for or its anchor has no view to measure' : `${started} switches with the label asked for, not one`)
  }
  const [sw, ...anchors] = await measured('__e2eSwitchFrames', 'the switch measured')
  if (!sw) throw new Error('the switch was not measured')
  const at = await anchor.getLocation()
  const size = await anchor.getSize()
  const sized = anchors.filter(a => Math.abs(a.width - size.width) <= 1 && Math.abs(a.height - size.height) <= 1)
  const placed = new Set(sized.map(a => `${a.x},${a.y}`))
  if (placed.size !== 1) throw new Error(`${placed.size} "${anchorLabel}" frames the size of its element, not one`)
  const ref = sized[0]!
  const frame = {...sw, x: sw.x + at.x - ref.x, y: sw.y + at.y - ref.y}
  const {height: window, width} = await browser.getWindowRect()
  if (frame.width <= 0 || frame.height <= 0 || frame.x < 0 || frame.y < 0 || frame.x + frame.width > width || frame.y + frame.height > window) {
    throw new Error(`the switch is not wholly on screen: ${JSON.stringify(frame)}`)
  }
  const before = await switchOn()
  if (!before.length || before.some(o => o !== before[0])) throw new Error(`the switch reads ${JSON.stringify(before)}`)
  await browser.execute('mobile: tap', {x: Math.round(frame.x + frame.width / 2), y: Math.round(frame.y + frame.height / 2)})
  // an unmounted switch reads no value, which is not a turn
  await waitFor(
    'the switch to turn',
    async () => {
      const now = await switchOn()
      return now.length > 0 && now.every(o => o !== before[0]) ? true : undefined
    },
    {interval: 200, timeout: 5_000}
  )
  return before[0]!
}

// The waiting keys the app holds right now (a spinner or a disabled control waits on each).
export const heldWaitingKeys = async () =>
  jsEval<Array<string>>(
    `return [...kbModule('stores/waiting.tsx').useWaitingState.getState().counts].filter(([, n]) => n > 0).map(([k]) => k)`
  )

// Notes the recorder's call seq the moment the signed-in account changes, so callsSince of it lists
// only the calls made after the change. Read it with accountChangedSeq; stopAccountChangeWatch ends it.
export const watchAccountChange = async () =>
  jsEval<boolean>(`
    const g = globalThis
    const recorder = g.__kbE2ERecorder
    if (!recorder) throw new Error('e2e account watch: the app has no __kbE2ERecorder')
    if (g.__e2eUidWatch) g.__e2eUidWatch()
    g.__e2eAccountChangedSeq = null
    g.__e2eUidWatch = kbModule('stores/current-user.tsx').useCurrentUserState.subscribe((s, prev) => {
      if (s.uid !== prev.uid && g.__e2eAccountChangedSeq === null) g.__e2eAccountChangedSeq = recorder.calls(Number.MAX_SAFE_INTEGER).seq
    })
    return true
  `, {once: true})

// The call seq at the first account change since watchAccountChange, or null before one.
export const accountChangedSeq = async () => jsEval<number | null>(`return globalThis.__e2eAccountChangedSeq ?? null`)

// Cleanup: nothing when no watch runs.
export const stopAccountChangeWatch = async () => {
  await jsEval<boolean>(`
    const g = globalThis
    if (g.__e2eUidWatch) g.__e2eUidWatch()
    g.__e2eUidWatch = undefined
    return true
  `, {once: true})
}

// Starts a switch to another account signed in on this device through the app's own switch (what
// the account switcher's row calls), for a flow that keeps typing while it runs.
export const startAppAccountSwitch = async (username: string) => {
  // only the dispatch is paused: the flow's typing during the switch must still be credited
  const started = await withHarnessRpcs('the account switch', async () =>
    jsEval<boolean>(
      `return !!kbModule('stores/config.tsx').useConfigState.getState().dispatch.switchToAccount(${JSON.stringify(username)})`,
      {once: true}
    )
  )
  if (!started) throw new Error('the app would not start the account switch')
}

// -- asking the phone's own service --------------------------------------------------------------

const RPC_CHAT = `kbModule('constants/rpc/rpc-chat-gen.tsx')`
const RPC_GEN = `kbModule('constants/rpc/rpc-gen.tsx')`
const CHAT_TYPES = `kbModule('constants/types/chat/index.tsx')`

// The emoji skin tone the phone's service keeps for the signed-in account (ReacjiSkinTone: 0 the
// default, 1 to 5). The service keeps it on the device, so the host cannot read the phone's.
export const appSkinTone = async () =>
  askApp<number>(
    "the phone's skin tone",
    `${RPC_GEN}.configGetBootstrapStatusRpcPromise().then(s => (s && s.userReacjis && s.userReacjis.skinTone) || 0)`
  )

// Restores the phone's skin tone through its service (a restore only: the UI's pick is what counts).
export const restoreAppSkinTone = async (tone: number) => {
  await askApp<boolean>(
    'restoring the skin tone',
    `${RPC_CHAT}.localPutReacjiSkinToneRpcPromise({skinTone: ${Number(tone)}}).then(() => true)`
  )
}

// The skin tone the app holds now (what its pickers show), read off its daemon store, or undefined
// before its bootstrap status has loaded.
export const shownSkinTone = async () =>
  jsEval<number | null>(`
    const s = kbModule('stores/daemon.tsx').useDaemonState.getState().bootstrapStatus
    return s ? (s.userReacjis && s.userReacjis.skinTone) || 0 : null
  `).then(t => t ?? undefined)

// The id of the message pinned in a conversation as the phone's own service shows it to the
// signed-in account, or null when it shows none (none pinned, or this device dismissed the pin: the
// service keeps a dismissal on the device that made it).
export const appPinnedMessageID = async (convID: string) =>
  askApp<number | null>(
    'the pin as the phone reads it',
    `${RPC_CHAT}.localGetInboxAndUnboxUILocalRpcPromise({
       identifyBehavior: 6,
       query: {computeActiveList: false, convIDs: [${CHAT_TYPES}.keyToConversationID(${JSON.stringify(convID)})], readOnly: false, unreadOnly: false},
     }).then(res => {
       const conv = (res.conversations || [])[0]
       if (!conv) throw new Error('the phone reads no such conversation')
       const pinned = conv.pinnedMsg
       return pinned ? (pinned.message && pinned.message.valid ? pinned.message.valid.messageID : -1) : null
     })`
  )

// Cancels outbox records on the phone's own service, by their outbox ids: a cleanup, never the
// UI's Cancel. CancelPost of a record already gone answers too.
export const cancelAppOutbox = async (outboxIDs: ReadonlyArray<string>) => {
  for (const id of outboxIDs) {
    await askApp<boolean>(
      'cancelling a stuck outbox record',
      `${RPC_CHAT}.localCancelPostRpcPromise({outboxID: ${CHAT_TYPES}.outboxIDToRpcOutboxID(${JSON.stringify(id)})}).then(() => true)`
    )
  }
}

// -- a message's send state ----------------------------------------------------------------------

// A loaded message's state as the store holds it: whether it was edited, whether it explodes (and
// has, and who exploded it early), and, while it is not yet sent, its outbox record: its submit state
// and the error the service gave (errorTyp, OutboxErrorType: 3 is too long).
type StoredMessageState = {
  edited: boolean
  errorTyp: number | null
  exploded: boolean
  explodedBy: string
  exploding: boolean
  id: number
  outboxID: string | null
  submitState: string | null
  text: string
}
// null when the mounted thread has no such message; throws while no thread is mounted.
export const storedMessageState = async (ordinal: number) =>
  jsEval<StoredMessageState | null>(`${threadStoreBody}
    e2eRequireThreadStore()
    const m = st.messageMap.get(${ordinal})
    if (!m) return null
    return {
      edited: !!m.hasBeenEdited,
      errorTyp: typeof m.errorTyp === 'number' ? m.errorTyp : null,
      exploded: !!m.exploded,
      explodedBy: m.explodedBy || '',
      exploding: !!m.exploding,
      id: Number(m.id) || 0,
      outboxID: m.outboxID ? String(m.outboxID) : null,
      submitState: m.submitState || null,
      text: bodyOf(m).trim(),
    }
  `)

// The outbox ids of the visible thread's loaded messages, not yet sent, whose text contains `text`.
export const outboxIDsWithText = async (text: string) =>
  jsEval<Array<string>>(`${threadStoreBody}
    if (!st) return []
    const out = []
    for (const o of st.messageOrdinals || []) {
      const m = st.messageMap.get(o)
      if (m && !Number(m.id) && m.outboxID && bodyOf(m).includes(${JSON.stringify(text)})) out.push(String(m.outboxID))
    }
    return out
  `)

// The exploding mode the visible thread's composer sends with, in seconds (0: off).
export const explodingModeSeconds = async () =>
  jsEval<number | null>(`${threadStoreBody}
    return st ? st.explodingMode || 0 : null
  `)

// -- the composer's pasteboard -------------------------------------------------------------------

// Long-presses the composer until its edit menu shows Paste, and taps it: what a person does to paste.
// The pasteboard is set before (gate/device.ts setPasteboard). Bound: the field and its tap 3, pasteFromMenu 18 = 21.
export const pasteIntoComposer = async () => {
  const input = await el(T.CHAT_INPUT).getElement()
  await input.click()
  await pasteFromMenu({elementId: input.elementId}, 'the composer')
}

// -- the GIF picker ------------------------------------------------------------------------------

// Whether the visible screen draws the GIF picker: the phone's is a web view of the service's
// gallery page (its url's key starts "gg"), read off the React tree.
export const giphyGalleryShown = async () =>
  jsEval<boolean>(`${fiberPrelude}
    const stack = [e2eRootFiber()]
    while (stack.length) {
      const f = stack.pop()
      const p = f.memoizedProps
      if (p && p.source && typeof p.source.uri === 'string' && /[?&]key=gg/.test(p.source.uri)) return true
      if (f.sibling) stack.push(f.sibling)
      if (f.child) stack.push(f.child)
    }
    return false
  `)

// -- the info panel, labels and the inbox's own state --------------------------------------------

// Opens the visible conversation's info panel from the header's More menu and, given one, a tab of
// it (its testID). Bound: the header menu 15, the tab 5 and its taps 5 = 25.
export const openInfoPanel = async (tab?: string) => {
  await openHeaderMenuItem('Info', async () => el(T.CHAT_INFO_PANEL).isExisting())
  if (tab === undefined) return
  await el(tab).waitForExist({timeout: 5_000})
  // a tap while the panel still comes up can do nothing (seen live): tapped again until the panel's
  // tabs read it selected
  await waitFor(
    'the info panel tab to be selected',
    async () => {
      if (await infoPanelTabSelected(tab)) return true
      await el(tab).click()
      return (await infoPanelTabSelected(tab)) ? true : undefined
    },
    {interval: 500, timeout: 5_000}
  )
}

// Whether the info panel's tab with testID `tab` is the selected one, read off the tabs' props.
const infoPanelTabSelected = async (tab: string) =>
  jsEval<boolean>(`${fiberPrelude}
    const stack = [e2eRootFiber()]
    while (stack.length) {
      const f = stack.pop()
      const p = f.memoizedProps
      if (p && Array.isArray(p.tabs) && p.selectedTab !== undefined) {
        const t = p.tabs.find(x => x && x.testID === ${JSON.stringify(tab)})
        if (t) return p.selectedTab === t.title
      }
      if (f.sibling) stack.push(f.sibling)
      if (f.child) stack.push(f.child)
    }
    return false
  `)

// Drags the screen's scrolling content up until `target` sits on screen, with room above the bottom
// edge for a tap, as a person scrolls a settings list to an item below the fold; or, at the content's
// end (a drag no longer moves it), wholly on screen. Bound: `timeout`.
export const dragUntilOnScreen = async (what: string, target: () => ChainablePromiseElement, timeout = 20_000) => {
  let lastY: number | undefined
  return waitFor(
    `${what} on screen`,
    async () => {
      const e = target()
      if (await e.isExisting()) {
        const {y} = await e.getLocation()
        const {height} = await e.getSize()
        const {height: window} = await browser.getWindowRect()
        if (y > 0 && y + height / 2 < window - 80) return true
        if (lastY !== undefined && Math.abs(lastY - y) < 1 && y > 0 && y + height <= window) return true
        lastY = y
      }
      const {height, width} = await browser.getWindowRect()
      const x = Math.round(width / 2)
      await browser
        .action('pointer', {parameters: {pointerType: 'touch'}})
        .move({x, y: Math.round(height * 0.7)})
        .down()
        .move({duration: 400, x, y: Math.round(height * 0.3)})
        .pause(200)
        .up()
        .perform()
      return undefined
    },
    {interval: 300, timeout}
  )
}

// A button by its text, which an icon before it puts after its glyph and ", " in its label (the info
// panel's "Leave channel" and "Block" read "<glyph>, Leave channel" and "<glyph>, Block").
export const iconButton = (label: string) =>
  browser.$(
    `-ios predicate string:type == "XCUIElementTypeButton" AND (label == ${JSON.stringify(label)} OR label ENDSWITH ${JSON.stringify(`, ${label}`)})`
  )

const INBOX_METADATA = `kbModule('chat/inbox/metadata-store.tsx').useInboxMetadataState.getState()`
const INBOX_LAYOUT = `kbModule('chat/inbox/layout-state.tsx')`

// Whether the app holds a conversation muted (its inbox metadata), or undefined before it has loaded it.
export const appConversationMuted = async (convID: string) =>
  jsEval<boolean | null>(`
    const m = ${INBOX_METADATA}.metas.get(${JSON.stringify(convID)})
    return m ? !!m.isMuted : null
  `).then(v => v ?? undefined)

// Whether the app's inbox layout pins a small conversation, or undefined while the layout has no row
// for it.
export const appConversationPinned = async (convID: string) =>
  jsEval<boolean | null>(`
    const l = ${INBOX_LAYOUT}
    const row = l.getSmallLayoutRow(l.useInboxLayoutState.getState(), ${JSON.stringify(convID)})
    return row ? !!row.isPinned : null
  `).then(v => v ?? undefined)

// Whether the app's inbox layout lists the conversation (as a small row or a big team's channel).
// Throws while the app holds no layout, so an absence is never read off an inbox not loaded yet.
export const appInboxLists = async (convID: string) => {
  const listed = await jsEval<boolean | null>(`
    const l = ${INBOX_LAYOUT}
    const s = l.useInboxLayoutState.getState()
    if (!s.layout) return null
    const id = ${JSON.stringify(convID)}
    return !!(l.getSmallLayoutRow(s, id) || l.getBigLayoutChannelRow(s, id))
  `)
  if (listed === null) throw new Error('the app holds no inbox layout yet')
  return listed
}

// The inbox dragged from its top to its end (until two drags up in a row change nothing). Returns how many items
// (rows and team headers) the inbox draws there. Same bound as scrollInboxTo.
export const scrollInboxToEnd = async () => {
  if ((await seekInbox(() => undefined)) !== undefined) throw new Error('the inbox picked an item while scrolling to its end')
  return (await drawnInbox()).items.length
}

// A loaded message's link previews as the visible thread's store holds them: its id, the domains
// the service asks the sender about (the unfurl prompt), and how many previews it carries.
type StoredUnfurls = {id: number; prompts: Array<string>; unfurls: number}
export const storedUnfurls = async (ordinal: number) =>
  jsEval<StoredUnfurls | null>(`${threadStoreBody}
    const m = st && st.messageMap.get(${ordinal})
    if (!m) return null
    const prompts = st.unfurlPrompt.get(m.id)
    return {id: Number(m.id) || 0, prompts: prompts ? [...prompts] : [], unfurls: m.unfurls ? m.unfurls.size : 0}
  `)

// -- attachments on the host -----------------------------------------------------------------------

// The sha256 of a file on this Mac, in hex.
export const fileSha = (file: string) => createHash('sha256').update(fs.readFileSync(file)).digest('hex')

// What `read` makes of the host's copy of attachment `m` in the smoke account's self conversation,
// downloaded into a folder of its own (mode 700) under /tmp/kb-e2e, removed after. Bound: the
// download 60, and `read`.
export const hostCopy = async <R,>(smokeUser: string, m: CliMessage, read: (file: string) => R) => {
  fs.mkdirSync('/tmp/kb-e2e', {recursive: true})
  const dir = fs.mkdtempSync(path.join('/tmp/kb-e2e', `dl-${e2eRunId()}-`))
  try {
    const file = path.join(dir, 'attachment')
    await downloadFromCli({tlfName: smokeUser}, m.id, file)
    return read(file)
  } finally {
    fs.rmSync(dir, {force: true, recursive: true})
  }
}
