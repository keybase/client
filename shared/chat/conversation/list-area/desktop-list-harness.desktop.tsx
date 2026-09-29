// Test support for the desktop thread list. jsdom has no layout, so this stands in for LegendList
// and for the stores the list reads: a fake list that records every imperative scroll, lays rows
// out on a fixed grid so the centering loop measures real offsets, and small external stores the
// tests drive in place of the thread, center and input providers.
import * as React from 'react'
import * as T from '@/constants/types'
import {centerStore, log, makeStore, resetShared, useStore} from './list-test-store'

export {
  centerStore,
  inputStateModule,
  inputStore,
  log,
  ords,
  range,
  setCenter,
  threadRefs,
  threadRefsValue,
} from './list-test-store'

export const rowHeight = 100
export const viewportHeight = 500

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

const contentHeight = () => (listProps.current?.data.length ?? 0) * rowHeight
const maxScroll = () => Math.max(0, contentHeight() - viewportHeight)
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
  // An animated scroll is not written down ahead: the list hears of it as the scroller moves, as it
  // does of the reader's.
  scrollToIndex: (opts: {animated?: boolean; index: number; viewPosition?: number}) => {
    log.push(['scrollToIndex', opts])
    const {mountsOnScrollToIndex, rendered, scrollToIndexError} = listStore.get()
    const target = listProps.current?.data[opts.index]
    const scroll = clampScroll(
      opts.index * rowHeight + rowHeight / 2 - viewportHeight * (opts.viewPosition ?? 0) + scrollToIndexError
    )
    listStore.set({
      rendered:
        rendered && mountsOnScrollToIndex && target !== undefined ? new Set([...rendered, target]) : rendered,
    })
    if (opts.animated) {
      moveScroller(scroll)
    } else {
      listStore.set({scroll})
    }
  },
  scrollToOffset: (opts: {offset: number}) => {
    log.push(['scrollToOffset', opts])
    listStore.set({scroll: clampScroll(opts.offset)})
  },
}

// The DOM scroller. The list's own scrolls write their offset down (listStore's scroll) and move it
// there together; anything else moves it first, and the list writes the new offset down only when its
// own scroll listener hears of it. Every move fires a scroll event, as the browser's do.
let scrollerElement: HTMLDivElement | null = null
let movedTo: number | undefined
let lastFired = 0
const scrollTop = () => movedTo ?? listStore.get().scroll
const fireScroll = () => {
  lastFired = scrollTop()
  scrollerElement?.dispatchEvent(new Event('scroll'))
}
listStore.subscribe(() => {
  if (scrollTop() !== lastFired) fireScroll()
})

// Moves the scroller to offset without the list moving it, as the reader does however they scroll,
// and as the scroller does when it clamps a scroll of the list's short.
export const moveScroller = (offset: number) => {
  const to = clampScroll(offset)
  if (to === scrollTop()) return
  movedTo = to
  fireScroll()
}
// The list's own scroll listener, writing down where something else moved the scroller.
const listHearsScroll = () => {
  if (movedTo === undefined) return
  const scroll = movedTo
  movedTo = undefined
  listStore.set({scroll})
}

// The list writes offset down and moves the scroller there, but the scroller clamps it at landsAt.
export const listLandsShort = (offset: number, landsAt: number) => {
  movedTo = landsAt
  listStore.set({scroll: offset})
}
// The scroller's current scroll coming to rest, whoever moved it.
export const scrollEnds = () => {
  scrollerElement?.dispatchEvent(new Event('scrollend'))
}

const FakeLegendList = (p: FakeListProps) => {
  const {data, ref} = p
  const rendered = useStore(listStore, s => s.rendered)
  React.useLayoutEffect(() => {
    listProps.current = p
  })
  React.useImperativeHandle(ref, () => handle, [])
  const scrollerRef = React.useCallback((el: HTMLDivElement | null) => {
    scrollerElement = el
    if (!el) return
    Object.defineProperty(el, 'scrollTop', {configurable: true, get: scrollTop})
    Object.defineProperty(el, 'scrollHeight', {
      configurable: true,
      get: () => Math.max(contentHeight(), viewportHeight),
    })
    Object.defineProperty(el, 'clientHeight', {configurable: true, get: () => viewportHeight})
  }, [])
  const rows = rendered ? data.filter(o => rendered.has(o)) : data
  return (
    <div data-testid="fake-scroller" onScroll={listHearsScroll} ref={scrollerRef}>
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
    const top = index * rowHeight - scrollTop()
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

export const resetHarness = () => {
  resetShared()
  listProps.current = undefined
  movedTo = undefined
  lastFired = 0
  listStore.reset(initialListState())
  threadStore.reset({clearVersion: 0, loaded: false, messageOrdinals: undefined, moreToLoadForward: false})
  markThreadAsRead.mockClear()
  toggleThreadSearch.mockClear()
  Object.values(centerActions).forEach(f => f.mockClear())
}
