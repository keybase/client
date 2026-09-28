// Test support for the desktop thread list. jsdom has no layout, so this stands in for LegendList
// and for the stores the list reads: a fake list that records every imperative scroll, lays rows
// out on a fixed grid so the centering loop measures real offsets, and small external stores the
// tests drive in place of the thread, center and input providers.
import * as React from 'react'
import * as T from '@/constants/types'
import type {ThreadRefsContext} from '../normal/context'
import {makeStore, useStore} from './list-test-store'

export const rowHeight = 100
export const viewportHeight = 500

// Everything the list does, in the order it did it: imperative scrolls on the list handle and the
// center/thread actions the list's buttons call.
export const log: Array<[string, unknown?]> = []

export const ords = (...ns: Array<number>) => ns.map(T.Chat.numberToOrdinal)
export const range = (from: number, to: number) => {
  const out: Array<number> = []
  for (let i = from; i <= to; i++) out.push(i)
  return ords(...out)
}

type ThreadState = {
  clearVersion: number
  loaded: boolean
  messageOrdinals: ReadonlyArray<T.Chat.Ordinal> | undefined
  moreToLoadForward: boolean
}
export const threadStore = makeStore<ThreadState>({
  clearVersion: 0,
  loaded: false,
  messageOrdinals: undefined,
  moreToLoadForward: false,
})

type CenterState = {
  centeredHighlightOrdinal: T.Chat.Ordinal | undefined
  centeredOrdinal: T.Chat.Ordinal | undefined
  hasCenter: boolean
}
export const centerStore = makeStore<CenterState>({
  centeredHighlightOrdinal: undefined,
  centeredOrdinal: undefined,
  hasCenter: false,
})
export const setCenter = (ordinal: T.Chat.Ordinal | undefined) =>
  centerStore.reset({centeredHighlightOrdinal: ordinal, centeredOrdinal: ordinal, hasCenter: !!ordinal})

type InputState = {editing: T.Chat.Ordinal | undefined}
export const inputStore = makeStore<InputState>({editing: undefined})

type ListState = {
  isAtEnd: boolean
  // Whether scrollToIndex mounts its target row, as the real list does once it scrolls there.
  mountsOnScrollToIndex: boolean
  // Rows mounted by the fake list; undefined mounts every row.
  rendered: Set<T.Chat.Ordinal> | undefined
  scroll: number
  // What scrollToEnd leaves isAtEnd as, so a test can model an end the list fails to reach.
  scrollToEndLands: boolean
  // How far scrollToIndex misses by, standing in for estimated row sizes above the target.
  scrollToIndexError: number
}
const initialListState = (): ListState => ({
  isAtEnd: false,
  mountsOnScrollToIndex: true,
  rendered: undefined,
  scroll: 0,
  scrollToEndLands: true,
  scrollToIndexError: 0,
})
export const listStore = makeStore<ListState>(initialListState())

type FakeListProps = {
  data: ReadonlyArray<T.Chat.Ordinal>
  ref?: React.Ref<unknown>
  [key: string]: unknown
}
// The props of the list's latest commit.
export const listProps: {current: FakeListProps | undefined} = {current: undefined}

const maxScroll = () => Math.max(0, (listProps.current?.data.length ?? 0) * rowHeight - viewportHeight)
const clampScroll = (offset: number) => Math.min(maxScroll(), Math.max(0, offset))

const handle = {
  getState: () => {
    const {isAtEnd, scroll} = listStore.get()
    return {isAtEnd, scroll, scrollLength: viewportHeight}
  },
  scrollToEnd: (opts: unknown) => {
    log.push(['scrollToEnd', opts])
    listStore.set({isAtEnd: listStore.get().scrollToEndLands, scroll: maxScroll()})
  },
  scrollToIndex: (opts: {index: number; viewPosition?: number}) => {
    log.push(['scrollToIndex', opts])
    const {mountsOnScrollToIndex, rendered, scrollToIndexError} = listStore.get()
    const target = listProps.current?.data[opts.index]
    const scroll = clampScroll(
      opts.index * rowHeight + rowHeight / 2 - viewportHeight * (opts.viewPosition ?? 0) + scrollToIndexError
    )
    listStore.set({
      rendered:
        rendered && mountsOnScrollToIndex && target !== undefined ? new Set([...rendered, target]) : rendered,
      scroll,
    })
  },
  scrollToOffset: (opts: {offset: number}) => {
    log.push(['scrollToOffset', opts])
    listStore.set({scroll: clampScroll(opts.offset)})
  },
}

type ScrollerMetrics = {clientHeight: number; scrollHeight: number; scrollTop: number}
// What the DOM scroller reports, which is what the list reads to decide it is already at its end.
export const scroller: {metrics: ScrollerMetrics} = {
  metrics: {clientHeight: 0, scrollHeight: 0, scrollTop: 0},
}

const FakeLegendList = (p: FakeListProps) => {
  const {data, ref} = p
  const rendered = useStore(listStore, s => s.rendered)
  React.useLayoutEffect(() => {
    listProps.current = p
  })
  React.useImperativeHandle(ref, () => handle, [])
  const scrollerRef = React.useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    for (const key of ['clientHeight', 'scrollHeight', 'scrollTop'] as const) {
      Object.defineProperty(el, key, {configurable: true, get: () => scroller.metrics[key]})
    }
  }, [])
  const rows = rendered ? data.filter(o => rendered.has(o)) : data
  return (
    <div data-testid="fake-scroller" ref={scrollerRef}>
      {rows.map(o => (
        <div key={String(o)} data-ordinal={o} />
      ))}
    </div>
  )
}

export const legendListModule = {LegendList: FakeLegendList}

// Rows sit on a fixed grid under the current scroll offset and the wrapper is the viewport, which
// is all the centering loop measures.
const rectFor = (el: Element) => {
  const ordinal = el.getAttribute('data-ordinal')
  if (ordinal !== null) {
    const index = (listProps.current?.data ?? []).findIndex(o => String(o) === ordinal)
    const top = index * rowHeight - listStore.get().scroll
    return {bottom: top + rowHeight, height: rowHeight, left: 0, right: 0, top, width: 0, x: 0, y: top}
  }
  if (el.getAttribute('data-testid') === 'chat-message-list') {
    return {bottom: viewportHeight, height: viewportHeight, left: 0, right: 0, top: 0, width: 0, x: 0, y: 0}
  }
  return {bottom: 0, height: 0, left: 0, right: 0, top: 0, width: 0, x: 0, y: 0}
}
export const installLayout = () =>
  jest
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockImplementation(function (this: HTMLElement) {
      return {...rectFor(this), toJSON: () => ({})} as DOMRect
    })

export const markThreadAsRead = jest.fn(() => {
  log.push(['markThreadAsRead'])
})
export const toggleThreadSearch = jest.fn((hide?: boolean) => {
  log.push(['toggleThreadSearch', hide])
})

export const threadContextModule = {
  ShownUsernameCacheContext: React.createContext(undefined),
  useConversationThreadID: () => T.Chat.stringToConversationIDKey('conv1'),
  useConversationThreadLoadNewerMessagesDueToScroll: () => () => {},
  useConversationThreadLoadOlderMessagesDueToScroll: () => () => {},
  useConversationThreadMarkThreadAsRead: () => markThreadAsRead,
  useConversationThreadSelector: <R,>(selector: (s: ThreadState) => R) => useStore(threadStore, selector),
  useConversationThreadStore: () => ({
    getState: () => ({
      messageMap: new Map(),
      messageOrdinals: threadStore.get().messageOrdinals,
      messageTypeMap: new Map(),
    }),
  }),
  useConversationThreadToggleSearch: () => toggleThreadSearch,
}

export const centerActions = {
  centerOnMessage: jest.fn((messageID: T.Chat.MessageID, highlightMode: string) => {
    log.push(['centerOnMessage', {highlightMode, messageID}])
  }),
  clearCenter: jest.fn(() => {
    log.push(['clearCenter'])
  }),
  jumpToRecent: jest.fn(() => {
    log.push(['jumpToRecent'])
  }),
}

export const centerContextModule = {
  useConversationCenter: () => useStore(centerStore, s => s),
  useConversationCenterActions: () => centerActions,
}

export const inputStateModule = {
  useConversationInput: <R,>(selector: (s: InputState) => R) => useStore(inputStore, selector),
}

type ScrollRef = {scrollDown: () => void; scrollToBottom: () => void; scrollUp: () => void}
// The list registers its imperative scrolls through ThreadRefsContext; this captures them.
export const threadRefs: {current: ScrollRef | null} = {current: null}
export const threadRefsValue: React.ContextType<typeof ThreadRefsContext> = {
  focusInput: () => {},
  scrollDown: () => threadRefs.current?.scrollDown(),
  scrollToBottom: () => threadRefs.current?.scrollToBottom(),
  scrollUp: () => threadRefs.current?.scrollUp(),
  setInputRef: () => {},
  setScrollRef: r => {
    threadRefs.current = r
  },
}

export const resetHarness = () => {
  log.length = 0
  listProps.current = undefined
  threadRefs.current = null
  scroller.metrics = {clientHeight: 0, scrollHeight: 0, scrollTop: 0}
  listStore.reset(initialListState())
  threadStore.reset({clearVersion: 0, loaded: false, messageOrdinals: undefined, moreToLoadForward: false})
  centerStore.reset({centeredHighlightOrdinal: undefined, centeredOrdinal: undefined, hasCenter: false})
  inputStore.reset({editing: undefined})
  markThreadAsRead.mockClear()
  toggleThreadSearch.mockClear()
  Object.values(centerActions).forEach(f => f.mockClear())
}
