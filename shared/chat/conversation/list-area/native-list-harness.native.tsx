// Test support for the native thread list. Jest runs as desktop, so this stands in for the React
// Native FlatList and for everything native the list reads: a fake list that records every
// imperative scroll and hands its props back so tests can fire its callbacks (viewable items,
// scroll, content size, drag, scroll-to-index failure), plus small external stores the tests drive
// in place of the thread, center and keyboard providers.
import * as React from 'react'
import * as T from '@/constants/types'
import type {ThreadRefsContext} from '../normal/context'
import {emptyThread, makeStore, useStore, type ThreadSnapshot} from './list-test-store'

// Everything the list does, in the order it did it: imperative scrolls on the list handle, thread
// actions it calls and what it tells catch-up.
export const log: Array<[string, unknown?]> = []

export const ords = (...ns: Array<number>) => ns.map(T.Chat.numberToOrdinal)
export const range = (from: number, to: number) => {
  const out: Array<number> = []
  for (let i = from; i <= to; i++) out.push(i)
  return ords(...out)
}

type ThreadState = ThreadSnapshot & {conversationIDKey: T.Chat.ConversationIDKey}
const initialThreadState = (): ThreadState => ({
  ...emptyThread,
  conversationIDKey: T.Chat.stringToConversationIDKey('conv1'),
})
export const threadStore = makeStore<ThreadState>(initialThreadState())

type CenterState = {
  centeredHighlightOrdinal: T.Chat.Ordinal | undefined
  centeredOrdinal: T.Chat.Ordinal | undefined
  hasCenter: boolean
}
const noCenter: CenterState = {centeredHighlightOrdinal: undefined, centeredOrdinal: undefined, hasCenter: false}
export const centerStore = makeStore<CenterState>(noCenter)
export const setCenter = (ordinal: T.Chat.Ordinal | undefined) =>
  centerStore.reset({centeredHighlightOrdinal: ordinal, centeredOrdinal: ordinal, hasCenter: !!ordinal})

export const keyboardStore = makeStore({isVisible: false})

type InputState = {editing: T.Chat.Ordinal | undefined}
export const inputStore = makeStore<InputState>({editing: undefined})
export const inputStateModule = {
  useConversationInput: <R,>(selector: (s: InputState) => R) => useStore(inputStore, selector),
}

export const bottomInset = 34
// The safe-area inset is React state, so a change re-renders the list.
export const insetStore = makeStore({bottomInset})
// The composer anchor's shared values; tests move keyboardHeight the way reanimated would.
export const anchor = {
  keyboardHeight: {value: 0},
  keyboardProgress: {value: 0},
}

type ViewToken = {index: number | null; item: T.Chat.Ordinal}
type FakeListProps = {
  data: ReadonlyArray<T.Chat.Ordinal>
  maintainVisibleContentPosition: unknown
  onContentSizeChange: (w: number, h: number) => void
  onScroll: (e: {
    nativeEvent: {contentOffset: {y: number}; contentSize: {height: number}; layoutMeasurement: {height: number}}
  }) => void
  onScrollBeginDrag: () => void
  onScrollToIndexFailed: (info: unknown) => void
  onViewableItemsChanged: (info: {viewableItems: Array<ViewToken>}) => void
  ref?: React.Ref<unknown>
  [key: string]: unknown
}
// The props of the list's latest commit.
export const listProps: {current: FakeListProps | undefined} = {current: undefined}

// How many times the list has mounted; it is keyed by conversation.
export const listMounts = {count: 0}

const handle = {
  scrollToItem: (opts: unknown) => {
    log.push(['scrollToItem', opts])
  },
  scrollToOffset: (opts: unknown) => {
    log.push(['scrollToOffset', opts])
  },
}

const FakeFlatList = (p: FakeListProps) => {
  const {ref} = p
  React.useLayoutEffect(() => {
    listProps.current = p
  })
  React.useEffect(() => {
    listMounts.count += 1
  }, [])
  React.useImperativeHandle(ref, () => handle, [])
  return null
}

export const reactNativeModule = {
  ...(jest.requireActual('react-native') as object),
  FlatList: FakeFlatList,
}

const Passthrough = (p: {children?: React.ReactNode}) => <>{p.children}</>

// Jest maps every native-only package to one stub file, so mocking one mocks them all: this one
// module stands in for both react-native-keyboard-controller and react-native-reanimated.
export const nativeOnlyModule = {
  __esModule: true,
  KeyboardChatScrollView: () => null,
  default: {View: Passthrough},
  useAnimatedStyle: (f: () => unknown) => f(),
  useKeyboardState: <R,>(selector: (s: {isVisible: boolean}) => R) => useStore(keyboardStore, selector),
}

export const commonAdaptersModule = {
  Box2: Passthrough,
  ErrorBoundary: Passthrough,
  Styles: {createStyleHook: (f: (theme: object) => unknown) => () => f({})},
}

export const composerViewportModule = {
  useComposerAnchor: () => ({...anchor, bottomInset: useStore(insetStore, s => s.bottomInset)}),
}

export const markThreadAsRead = jest.fn(() => {
  log.push(['markThreadAsRead'])
})
export const loadOlderMessages = jest.fn((numOrdinals: number) => {
  log.push(['loadOlderMessages', numOrdinals])
})

export const threadContextModule = {
  ShownUsernameCacheContext: React.createContext(undefined),
  useConversationThreadID: () => useStore(threadStore, s => s.conversationIDKey),
  useConversationThreadLoadNewerMessagesDueToScroll: () => () => {},
  useConversationThreadLoadOlderMessagesDueToScroll: () => loadOlderMessages,
  useConversationThreadMarkThreadAsRead: () => markThreadAsRead,
  useConversationThreadSelector: <R,>(selector: (s: ThreadState) => R) => useStore(threadStore, selector),
  useConversationThreadStore: () => ({
    getState: () => ({
      messageMap: new Map(),
      messageOrdinals: threadStore.get().messageOrdinals,
      messageTypeMap: new Map(),
    }),
  }),
}

export const centerContextModule = {
  useConversationCenter: () => useStore(centerStore, s => s),
}

// The list hands useJumpToRecent the scroll its button runs; the real button also clears the centre
// and reloads, which belongs to the thread, not the list.
export const jumpToRecent: {scroll: (() => void) | undefined} = {scroll: undefined}
export const jumpToRecentModule = {
  useJumpToRecent: (scroll: () => void) => {
    jumpToRecent.scroll = scroll
    return null
  },
}

export const catchUpModule = {
  CatchUp: () => null,
  useCatchUp: () => ({
    onCatchUp: () => {},
    onViewableOrdinalsChanged: (ordinal: T.Chat.Ordinal | undefined) => {
      log.push(['oldestVisible', ordinal])
    },
    showCatchUp: false,
  }),
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
  listMounts.count = 0
  threadRefs.current = null
  jumpToRecent.scroll = undefined
  anchor.keyboardHeight.value = 0
  anchor.keyboardProgress.value = 0
  threadStore.reset(initialThreadState())
  centerStore.reset(noCenter)
  keyboardStore.reset({isVisible: false})
  inputStore.reset({editing: undefined})
  insetStore.reset({bottomInset})
  markThreadAsRead.mockClear()
  loadOlderMessages.mockClear()
}
