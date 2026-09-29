// Test support for the desktop thread list. jsdom has no layout, so this stands in for LegendList
// and for the stores the list reads: a fake list that records every imperative scroll, lays rows
// out on a fixed grid so the centering loop measures real offsets, and small external stores the
// tests drive in place of the thread, center and input providers.
import * as React from 'react'
import * as T from '@/constants/types'
import {act} from '@testing-library/react'
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
// The thread's wrapper keeps the gap above the composer as its own paddingBottom, outside the scroller.
export const wrapperPaddingBottom = 8

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
  // Rows taller than rowHeight.
  rowHeights: ReadonlyMap<T.Chat.Ordinal, number>
  scroll: number
  // What scrollToEnd leaves isAtEnd as, so a test can model an end the list fails to reach.
  scrollToEndLands: boolean
  // How far scrollToIndex misses by, standing in for estimated row sizes above the target.
  scrollToIndexError: number
  // The scroller's height as laid out, and as the list last heard of it: the list measures its
  // viewport only when its resize observer reports, after the layout that changed it.
  viewport: number
  listViewport: number
}
const initialListState = (): ListState => ({
  isAtEnd: false,
  mountsOnScrollToIndex: true,
  rendered: undefined,
  rowHeights: new Map(),
  scroll: 0,
  scrollToEndLands: true,
  scrollToIndexError: 0,
  listViewport: viewportHeight,
  viewport: viewportHeight,
})
export const listStore = makeStore<ListState>(initialListState())

type FakeListProps = {
  data: ReadonlyArray<T.Chat.Ordinal>
  ref?: React.Ref<unknown>
  [key: string]: unknown
}
// The props of the list's latest commit, and of each commit, oldest first.
export const listProps: {current: FakeListProps | undefined} = {current: undefined}
export const listCommits: Array<FakeListProps> = []

const heightOf = (ordinal: T.Chat.Ordinal | undefined) =>
  (ordinal === undefined ? undefined : listStore.get().rowHeights.get(ordinal)) ?? rowHeight
// Where the row at index starts in the content.
const rowTop = (index: number) =>
  (listProps.current?.data ?? []).slice(0, index).reduce((top, o) => top + heightOf(o), 0)
const contentHeight = () => rowTop(listProps.current?.data.length ?? 0)
// The list clamps its own scrolls against the viewport it has heard of, the scroller against its own.
const maxScroll = () => Math.max(0, contentHeight() - listStore.get().listViewport)
const clampScroll = (offset: number) => Math.min(maxScroll(), Math.max(0, offset))
const scrollerMax = () => Math.max(0, contentHeight() - listStore.get().viewport)

export const listHandle = {
  getScrollableNode: () => scrollerElement,
  getState: () => {
    const {isAtEnd, listViewport, scroll} = listStore.get()
    const data = listProps.current?.data ?? []
    // The first row in view.
    const start = Math.max(0, data.findIndex((_o, i) => rowTop(i + 1) > scroll))
    return {isAtEnd, scroll, scrollLength: listViewport, start}
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
      rowTop(opts.index) +
        heightOf(target) / 2 -
        listStore.get().listViewport * (opts.viewPosition ?? 0) +
        scrollToIndexError
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
  const to = Math.min(scrollerMax(), Math.max(0, offset))
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
const reportLayout = (height: number) => {
  const onLayout = listProps.current?.['onLayout'] as
    | ((e: {nativeEvent: {layout: {height: number; width: number; x: number; y: number}}}) => void)
    | undefined
  onLayout?.({nativeEvent: {layout: {height, width: 0, x: 0, y: 0}}})
}
// The scroller changing height (the composer growing, a window resize), keeping its scrollTop as the
// browser does. The list hears of it only later (listHearsLayout).
export const resizeViewport = (height: number) => {
  listStore.set({viewport: height})
}
// The list's resize observer reporting the scroller's height: the list records it as its viewport,
// re-reads whether it is at its end, and hands the layout to its onLayout prop. The list's own end
// anchor, which re-pins here when its maintainScrollAtEnd prop is on, is not simulated.
export const listHearsLayout = () => {
  const {scroll, viewport} = listStore.get()
  act(() => {
    listStore.set({isAtEnd: scroll >= contentHeight() - viewport, listViewport: viewport})
    reportLayout(viewport)
  })
}
// A rendered row measuring at a new height after the list laid it out (an image or a font landing, a
// late re-measure): the list records it, re-reads whether it is at its end, and reports the change to
// its onItemSizeChanged prop. The list's own end anchor, which re-pins here only for a change of more
// than a few pixels, is not simulated.
export const remeasureRow = (ordinal: T.Chat.Ordinal, height: number) => {
  const previous = heightOf(ordinal)
  act(() => {
    listStore.set({rowHeights: new Map([...listStore.get().rowHeights, [ordinal, height]])})
    const {listViewport, scroll} = listStore.get()
    listStore.set({isAtEnd: scroll >= contentHeight() - listViewport})
    const data = listProps.current?.data ?? []
    const onItemSizeChanged = listProps.current?.['onItemSizeChanged'] as
      | ((info: {index: number; itemData: T.Chat.Ordinal; itemKey: string; previous: number; size: number}) => void)
      | undefined
    onItemSizeChanged?.({index: data.indexOf(ordinal), itemData: ordinal, itemKey: String(ordinal), previous, size: height})
  })
}
// The scroller's current scroll coming to rest, whoever moved it.
export const scrollEnds = () => {
  act(() => {
    scrollerElement?.dispatchEvent(new Event('scrollend'))
  })
}

const FakeLegendList = (p: FakeListProps) => {
  const {data, ref} = p
  const rendered = useStore(listStore, s => s.rendered)
  React.useLayoutEffect(() => {
    listProps.current = p
    listCommits.push(p)
  })
  React.useImperativeHandle(ref, () => listHandle, [])
  // The list measures its viewport as it mounts, as the real one does in a layout effect.
  React.useLayoutEffect(() => {
    reportLayout(listStore.get().listViewport)
  }, [])
  const scrollerRef = React.useCallback((el: HTMLDivElement | null) => {
    scrollerElement = el
    if (!el) return
    Object.defineProperty(el, 'scrollTop', {configurable: true, get: scrollTop})
    Object.defineProperty(el, 'scrollHeight', {
      configurable: true,
      get: () => Math.max(contentHeight(), listStore.get().viewport),
    })
    Object.defineProperty(el, 'clientHeight', {configurable: true, get: () => listStore.get().viewport})
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

// Rows sit on a fixed grid under the current scroll offset and the scroller is the viewport, which
// is all the centering loop measures. The wrapper around it reaches its padding further down.
const rectFor = (el: Element) => {
  const ordinal = el.getAttribute('data-ordinal')
  if (ordinal !== null) {
    const data = listProps.current?.data ?? []
    const index = data.findIndex(o => String(o) === ordinal)
    const top = rowTop(index) - scrollTop()
    const height = heightOf(data[index])
    return {bottom: top + height, height, left: 0, right: 0, top, width: 0, x: 0, y: top}
  }
  const {viewport} = listStore.get()
  if (el.getAttribute('data-testid') === 'fake-scroller') {
    return {bottom: viewport, height: viewport, left: 0, right: 0, top: 0, width: 0, x: 0, y: 0}
  }
  if (el.getAttribute('data-testid') === 'chat-message-list') {
    const height = viewport + wrapperPaddingBottom
    return {bottom: height, height, left: 0, right: 0, top: 0, width: 0, x: 0, y: 0}
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
  listCommits.length = 0
  movedTo = undefined
  lastFired = 0
  listStore.reset(initialListState())
  threadStore.reset({clearVersion: 0, loaded: false, messageOrdinals: undefined, moreToLoadForward: false})
  markThreadAsRead.mockClear()
  toggleThreadSearch.mockClear()
  Object.values(centerActions).forEach(f => f.mockClear())
}
