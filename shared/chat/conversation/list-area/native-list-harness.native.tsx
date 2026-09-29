// Test support for the native thread list. Jest runs as desktop, so this stands in for the React
// Native FlatList and for everything native the list reads: a fake list that records every
// imperative scroll and hands its props back so tests can fire its callbacks (viewable items,
// scroll, content size, drag, scroll-to-index failure), plus small external stores the tests drive
// in place of the thread, center and keyboard providers.
import * as React from 'react'
import * as T from '@/constants/types'
import {centerStore, emptyThread, log, makeStore, resetShared, useStore, type ThreadSnapshot} from './list-test-store'

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

type ThreadState = ThreadSnapshot & {conversationIDKey: T.Chat.ConversationIDKey}
const initialThreadState = (): ThreadState => ({
  ...emptyThread,
  conversationIDKey: T.Chat.stringToConversationIDKey('conv1'),
})
export const threadStore = makeStore<ThreadState>(initialThreadState())

export const keyboardStore = makeStore({isVisible: false})

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
  onMomentumScrollEnd: (e: {nativeEvent: {contentOffset: {y: number}}}) => void
  onScrollBeginDrag: () => void
  onScrollEndDrag: (e: {nativeEvent: {contentOffset: {y: number}; velocity?: {x: number; y: number}}}) => void
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

export const resetHarness = () => {
  resetShared()
  listProps.current = undefined
  listMounts.count = 0
  jumpToRecent.scroll = undefined
  anchor.keyboardHeight.value = 0
  anchor.keyboardProgress.value = 0
  threadStore.reset(initialThreadState())
  keyboardStore.reset({isVisible: false})
  insetStore.reset({bottomInset})
  markThreadAsRead.mockClear()
  loadOlderMessages.mockClear()
}
