import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as Hooks from './hooks'
import * as React from 'react'
import * as T from '@/constants/types'
import Separator from '../messages/separator'
import SpecialBottomMessage from '../messages/special-bottom-message'
import SpecialTopMessage from '../messages/special-top-message'
import {MessageRow} from '../messages/wrapper'
import {PerfProfiler} from '@/perf/react-profiler'
import {ScrollContext} from '../normal/context'
import {useConversationCenter} from '../center-context'
import {
  useConversationThreadID,
  useConversationThreadLoadNewerMessagesDueToScroll,
  useConversationThreadLoadOlderMessagesDueToScroll,
  useConversationThreadSelector,
  useConversationThreadStore,
} from '../thread-context'
import {useThreadLoadStatusOptionsGetter} from '../thread-load-status-context'
import {getMessageRowType} from '../messages/row-metadata'
import * as InputState from '../input-area/input-state'
import sortedIndexOf from 'lodash/sortedIndexOf'
import {copyToClipboard} from '@/util/storeless-actions'
import {FocusContext} from '../normal/context'
import noop from 'lodash/noop'
import {LegendList} from '@legendapp/list/react'
import type {LegendListRef} from '@/common-adapters'
import {FlatList} from 'react-native'
import type {ScrollViewProps} from 'react-native'
import {usingFlashList} from './flashlist-config'
import {mobileTypingContainerHeight} from '../input-area/normal/typing'
import {KeyboardChatScrollView} from 'react-native-keyboard-controller'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import type {ItemType} from './index.shared'

const noOrdinals: ReadonlyArray<T.Chat.Ordinal> = []

// ==================== DESKTOP ====================

const HighlightableRow = React.memo(({ordinal}: {ordinal: T.Chat.Ordinal}) => {
  const {centeredHighlightOrdinal} = useConversationCenter()
  const editingOrdinal = InputState.useConversationInput(s => s.editing)
  const isHighlighted = centeredHighlightOrdinal === ordinal || editingOrdinal === ordinal
  return (
    <div
      data-ordinal={ordinal}
      className={Kb.Styles.classNames(
        'hover-container',
        'WrapperMessage',
        'WrapperMessage-hoverBox',
        'WrapperMessage-decorated',
        'WrapperMessage-hoverColor',
        {highlighted: isHighlighted}
      )}
    >
      <Separator trailingItem={ordinal} />
      <MessageRow isCenteredHighlight={centeredHighlightOrdinal === ordinal} ordinal={ordinal} />
    </div>
  )
})
HighlightableRow.displayName = 'HighlightableRow'

const DesktopThreadWrapper = function DesktopThreadWrapper() {
  const editingOrdinal = InputState.useConversationInput(s => s.editing)
  const conversationIDKey = useConversationThreadID()
  const data = useConversationThreadSelector(
    C.useShallow(s => ({
      containsLatestMessage: !s.moreToLoadForward,
      loaded: s.loaded,
      messageOrdinals: s.messageOrdinals ?? noOrdinals,
    }))
  )
  const {centeredOrdinal} = useConversationCenter()
  const {containsLatestMessage, messageOrdinals, loaded} = data

  const listRef = React.useRef<LegendListRef | null>(null)
  const wrapperRef = React.useRef<HTMLDivElement | null>(null)
  const [didFirstLoad, setDidFirstLoad] = React.useState(false)

  const {markInitiallyLoadedThreadAsRead} = Hooks.useActions()
  const loadNewerMessagesDueToScroll = useConversationThreadLoadNewerMessagesDueToScroll()
  const loadOlderMessagesDueToScroll = useConversationThreadLoadOlderMessagesDueToScroll()
  const getThreadLoadStatusOptions = useThreadLoadStatusOptionsGetter()
  const threadStore = useConversationThreadStore()

  // Stable refs for values used inside stable callbacks
  const containsLatestMessageRef = React.useRef(containsLatestMessage)
  React.useEffect(() => {
    containsLatestMessageRef.current = containsLatestMessage
  }, [containsLatestMessage])

  const numOrdinalsRef = React.useRef(messageOrdinals.length)
  React.useEffect(() => {
    numOrdinalsRef.current = messageOrdinals.length
  }, [messageOrdinals.length])

  const messageOrdinalsRef = React.useRef(messageOrdinals)
  React.useEffect(() => {
    messageOrdinalsRef.current = messageOrdinals
  }, [messageOrdinals])

  // Item type for LegendList recycling pool separation
  const getItemType = React.useCallback(
    (ordinal: T.Chat.Ordinal) => {
      const {messageMap, messageTypeMap} = threadStore.getState()
      const message = messageMap.get(ordinal)
      return message ? getMessageRowType(message, messageTypeMap.get(ordinal)) : (messageTypeMap.get(ordinal) ?? 'text')
    },
    [threadStore]
  )

  // Imperative scroll for ScrollContext
  const scrollToBottom = React.useCallback(() => {
    void listRef.current?.scrollToEnd({animated: false})
  }, [])

  const scrollUp = React.useCallback(() => {
    const state = listRef.current?.getState()
    if (!state) return
    void listRef.current?.scrollToOffset({animated: false, offset: Math.max(0, state.scroll - state.scrollLength)})
  }, [])

  const scrollDown = React.useCallback(() => {
    const state = listRef.current?.getState()
    if (!state) return
    void listRef.current?.scrollToOffset({animated: false, offset: state.scroll + state.scrollLength})
  }, [])

  const {setScrollRef} = React.useContext(ScrollContext)
  React.useEffect(() => {
    setScrollRef({scrollDown, scrollToBottom, scrollUp})
  }, [scrollDown, scrollToBottom, scrollUp, setScrollRef])

  const isScrollingRef = React.useRef(false)
  const scrollStopTimerRef = React.useRef<ReturnType<typeof setTimeout>>(undefined)
  const onScroll = C.useThrottledCallback(
    (_event: unknown) => {
      clearTimeout(scrollStopTimerRef.current)
      scrollStopTimerRef.current = setTimeout(() => {
        isScrollingRef.current = false
        ;(wrapperRef.current as unknown as {classList: {remove: (c: string) => void}} | null)?.classList.remove('scroll-ignore-pointer')
      }, 200)
      if (!isScrollingRef.current) {
        isScrollingRef.current = true
        ;(wrapperRef.current as unknown as {classList: {add: (c: string) => void}} | null)?.classList.add('scroll-ignore-pointer')
      }
    },
    100,
    {leading: true, trailing: true}
  )
  React.useEffect(() => () => {
    onScroll.cancel()
  }, [onScroll])

  // Load older messages when scrolled near the top (first 3 items visible)
  const onViewableItemsChanged = C.useDebouncedCallback(
    ({viewableItems}: {viewableItems: Array<{index: number; item: T.Chat.Ordinal}>}) => {
      if ((viewableItems[0]?.index ?? Infinity) < 3) {
        loadOlderMessagesDueToScroll(numOrdinalsRef.current, getThreadLoadStatusOptions())
      }
    },
    200
  )

  // Load newer messages when scrolled to the end (only when not at latest)
  const onEndReached = C.useThrottledCallback(() => {
    if (!containsLatestMessageRef.current) {
      loadNewerMessagesDueToScroll(numOrdinalsRef.current, getThreadLoadStatusOptions())
    }
  }, 200)

  React.useEffect(() => () => {
    onEndReached.cancel()
  }, [onEndReached])

  // Scroll to centered ordinal when it changes (search / thread navigation).
  // Use a "last scrolled to" ref rather than a "did it change" ref so we still
  // scroll when loaded becomes true after centeredOrdinal was already set.
  const lastScrolledCenteredRef = React.useRef<T.Chat.Ordinal | undefined>(undefined)
  React.useLayoutEffect(() => {
    lastScrolledCenteredRef.current = undefined
  }, [conversationIDKey])

  React.useEffect(() => {
    if (!loaded) return
    if (centeredOrdinal) {
      if (lastScrolledCenteredRef.current === centeredOrdinal) return
      const idx = sortedIndexOf(messageOrdinalsRef.current as unknown as number[], centeredOrdinal as unknown as number)
      if (idx < 0) return
      lastScrolledCenteredRef.current = centeredOrdinal
      const target = centeredOrdinal
      const doScrollToCenter = async () => {
        for (let attempt = 0; attempt < 4; attempt++) {
          const el = wrapperRef.current?.querySelector(`[data-ordinal="${target}"]`)
          if (el) {
            el.scrollIntoView({behavior: 'instant', block: 'center'})
            return
          }
          void listRef.current?.scrollToIndex({animated: false, index: idx, viewPosition: 0.5})
          await new Promise<void>(r => setTimeout(r, 100))
        }
      }
      void doScrollToCenter()
    } else if (lastScrolledCenteredRef.current !== undefined) {
      lastScrolledCenteredRef.current = undefined
      if (containsLatestMessage) {
        void listRef.current?.scrollToEnd({animated: false})
      }
    }
  }, [centeredOrdinal, loaded, containsLatestMessage, messageOrdinals])

  // Scroll to the message being edited
  const lastEditingOrdinalRef = React.useRef<T.Chat.Ordinal | undefined>(undefined)
  React.useEffect(() => {
    if (lastEditingOrdinalRef.current === editingOrdinal) return
    lastEditingOrdinalRef.current = editingOrdinal
    if (!editingOrdinal) return
    const idx = sortedIndexOf(messageOrdinalsRef.current as unknown as number[], editingOrdinal as unknown as number)
    if (idx >= 0) {
      void listRef.current?.scrollToIndex({animated: true, index: idx, viewPosition: 0.5})
    }
  }, [editingOrdinal])

  // Mark thread as read after initial load (once per conversation)
  const markedReadRef = React.useRef(false)
  React.useLayoutEffect(() => {
    markedReadRef.current = false
  }, [conversationIDKey])

  const onLoad = React.useCallback(() => {
    setDidFirstLoad(true)
    if (!markedReadRef.current) {
      markedReadRef.current = true
      markInitiallyLoadedThreadAsRead()
    }
  }, [markInitiallyLoadedThreadAsRead])

  const renderItem = React.useCallback(
    ({item: ordinal}: {item: T.Chat.Ordinal}) => <HighlightableRow ordinal={ordinal} />,
    []
  )

  const jumpToRecent = Hooks.useJumpToRecent(scrollToBottom, messageOrdinals.length)

  const {focusInput} = React.useContext(FocusContext)
  const handleListClick = (ev: React.MouseEvent) => {
    const target = ev.target as {closest?: (s: string) => unknown; tagName?: string} | null
    const tagName = target?.tagName?.toUpperCase()
    if (tagName === 'INPUT' || tagName === 'TEXTAREA' || target?.closest?.('[data-search-filter="true"]')) return
    const sel = (globalThis as unknown as {getSelection?: () => {isCollapsed: boolean} | null}).getSelection?.()
    if (sel?.isCollapsed) focusInput()
  }

  const onCopyCapture = (e: React.BaseSyntheticEvent) => {
    type DocGlobal = {
      createElement: (tag: string) => {
        appendChild: (n: unknown) => void
        querySelectorAll: (sel: string) => ArrayLike<{parentNode?: {removeChild?: (n: unknown) => void; replaceChild?: (a: unknown, b: unknown) => void}}>
        textContent: string | null
        remove: () => void
      }
    }
    type WinGlobal = {
      getSelection: () => {
        getRangeAt: (i: number) => {cloneContents: () => unknown}
      } | null
    }
    e.preventDefault()
    const doc = (globalThis as unknown as {document?: DocGlobal}).document
    const win = (globalThis as unknown as {window?: WinGlobal}).window
    const sel = win?.getSelection()
    if (!sel || !doc) return
    const temp = sel.getRangeAt(0).cloneContents()
    const tempDiv = doc.createElement('div')
    tempDiv.appendChild(temp)
    const styles = tempDiv.querySelectorAll('style')
    Array.from(styles).forEach(s => {
      s.parentNode?.removeChild?.(s)
    })
    const imgs = tempDiv.querySelectorAll('img')
    Array.from(imgs).forEach(i => {
      const dummy = doc.createElement('div')
      dummy.textContent = '\n[IMAGE]\n'
      i.parentNode?.replaceChild?.(dummy, i)
    })
    const tc = tempDiv.textContent
    if (tc) {
      copyToClipboard(tc)
    }
    tempDiv.remove()
  }

  // When a centeredOrdinal is set at mount, start there; otherwise start at the end
  const initialScrollIndex = centeredOrdinal !== undefined
    ? {
        index: Math.max(0, sortedIndexOf(messageOrdinals as unknown as number[], centeredOrdinal as unknown as number)),
        viewPosition: 0.5 as const,
      }
    : undefined

  return (
    <Kb.ErrorBoundary>
      <div
        data-testid="message-list"
        style={Kb.Styles.castStyleDesktop(desktopStyles.container)}
        onClick={handleListClick}
        onCopyCapture={onCopyCapture}
        ref={wrapperRef}
      >
        <LegendList
          key={conversationIDKey}
          ref={listRef as React.Ref<LegendListRef>}
          data={messageOrdinals as unknown as T.Chat.Ordinal[]}
          renderItem={renderItem}
          keyExtractor={(ordinal: T.Chat.Ordinal) => String(ordinal)}
          getItemType={getItemType}
          ListHeaderComponent={SpecialTopMessage}
          ListFooterComponent={SpecialBottomMessage}
          recycleItems={true}
          drawDistance={250}
          estimatedItemSize={72}
          style={{...Kb.Styles.castStyleDesktop(desktopStyles.list), opacity: didFirstLoad ? 1 : 0}}
          initialScrollAtEnd={initialScrollIndex === undefined}
          initialScrollIndex={initialScrollIndex}
          maintainScrollAtEnd={centeredOrdinal ? false : {on: {dataChange: true}}}
          maintainVisibleContentPosition={centeredOrdinal ? undefined : {data: true}}
          onLoad={onLoad}
          onScroll={onScroll as unknown as (e: unknown) => void}
          onEndReached={onEndReached}
          onViewableItemsChanged={onViewableItemsChanged as unknown as (info: unknown) => void}
        />
        {jumpToRecent}
      </div>
    </Kb.ErrorBoundary>
  )
}

const desktopStyles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: Kb.Styles.platformStyles({
        isElectron: {
          bottom: 0,
          left: 0,
          overflow: 'hidden',
          position: 'absolute',
          right: 0,
          top: 0,
        },
      }),
      list: Kb.Styles.platformStyles({
        isElectron: {
          height: '100%',
          outline: 'none',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          paddingBottom: 16,
          scrollbarGutter: 'stable',
          width: '100%',
          willChange: 'transform',
        },
      }),
    }) as const
)

const DesktopThreadWrapperWithProfiler = () => (
  <PerfProfiler id="MessageList">
    <DesktopThreadWrapper />
  </PerfProfiler>
)

// ==================== NATIVE ====================

type RNFlatListRef = {
  scrollToOffset: (opts: {animated: boolean; offset: number}) => void
  scrollToItem: (opts: {animated: boolean; item: unknown; viewPosition?: number}) => void
}

const useInvertedMessageOrdinals = (messageOrdinals?: ReadonlyArray<T.Chat.Ordinal>) => {
  const source = messageOrdinals ?? noOrdinals
  return React.useMemo(() => (source.length > 1 ? [...source].reverse() : source), [source])
}

const useNativeScrolling = (p: {
  centeredOrdinal: T.Chat.Ordinal
  messageOrdinals: ReadonlyArray<T.Chat.Ordinal>
  conversationIDKey: T.Chat.ConversationIDKey
  listRef: React.RefObject<RNFlatListRef | null>
}) => {
  const {listRef, centeredOrdinal, messageOrdinals} = p
  const numOrdinals = messageOrdinals.length
  const loadOlderMessages = useConversationThreadLoadOlderMessagesDueToScroll()
  const getThreadLoadStatusOptions = useThreadLoadStatusOptionsGetter()
  const [scrollToBottom] = React.useState(() => () => {
    listRef.current?.scrollToOffset({animated: false, offset: 0})
  })

  const {setScrollRef} = React.useContext(ScrollContext)
  React.useEffect(() => {
    setScrollRef({scrollDown: noop, scrollToBottom, scrollUp: noop})
  }, [setScrollRef, scrollToBottom])

  // only scroll to center once per
  const lastScrollToCentered = React.useRef(-1)
  React.useEffect(() => {
    if (T.Chat.ordinalToNumber(centeredOrdinal) < 0) {
      lastScrollToCentered.current = -1
    }
  }, [centeredOrdinal])

  const centeredOrdinalRef = React.useRef(centeredOrdinal)
  React.useEffect(() => {
    centeredOrdinalRef.current = centeredOrdinal
  }, [centeredOrdinal])
  const [scrollToCentered] = React.useState(() => () => {
    setTimeout(() => {
      const list = listRef.current
      if (!list) {
        return
      }
      const co = centeredOrdinalRef.current
      if (lastScrollToCentered.current === co) {
        return
      }

      lastScrollToCentered.current = co
      list.scrollToItem({animated: false, item: co, viewPosition: 0.5})
    }, 100)
  })

  const onEndReached = () => {
    loadOlderMessages(numOrdinals, getThreadLoadStatusOptions())
  }

  return {
    onEndReached,
    scrollToBottom,
    scrollToCentered,
  }
}

// This keeps the list stable when data changes. If we don't do this it will jump around
// when new messages come in and its very easy to get this to cause an unstoppable loop of
// quick janking up and down
const maintainVisibleContentPosition = {autoscrollToTopThreshold: 1, minIndexForVisible: 0}

const NativeConversationList = function NativeConversationList() {
  const List = FlatList as unknown as React.ComponentType<Record<string, unknown> & {ref?: React.Ref<RNFlatListRef>}>

  const debugWhichList = __DEV__ ? (
    <Kb.Text type="HeaderBig" style={{backgroundColor: 'red', left: 0, position: 'absolute', top: 0}}>
      {usingFlashList ? 'FLASH' : 'old'}
    </Kb.Text>
  ) : null

  const conversationIDKey = useConversationThreadID()
  const listData = useConversationThreadSelector(
    C.useShallow(s => ({
      loaded: s.loaded,
      messageOrdinals: s.messageOrdinals,
    }))
  )
  const {centeredHighlightOrdinal, centeredOrdinal} = useConversationCenter()
  const noCenteredOrdinal = T.Chat.numberToOrdinal(-1)
  const centeredOrdinalOrNone = centeredOrdinal ?? noCenteredOrdinal
  const centeredHighlightOrdinalOrNone = centeredHighlightOrdinal ?? noCenteredOrdinal
  const {loaded} = listData

  const messageOrdinals = useInvertedMessageOrdinals(listData.messageOrdinals)

  const listRef = React.useRef<RNFlatListRef | null>(null)
  const {markInitiallyLoadedThreadAsRead} = Hooks.useActions()
  const keyExtractor = (ordinal: ItemType) => {
    return String(ordinal)
  }

  const renderItem = (info?: {item?: ItemType}) => {
    const ordinal = info?.item
    if (!ordinal) {
      return null
    }
    return <MessageRow isCenteredHighlight={centeredHighlightOrdinalOrNone === ordinal} ordinal={ordinal} />
  }

  const numOrdinals = messageOrdinals.length

  const threadStore = useConversationThreadStore()
  const getItemType = React.useCallback(
    (ordinal: T.Chat.Ordinal) => {
      if (!ordinal) {
        return 'null'
      }
      const {messageMap, messageTypeMap} = threadStore.getState()
      const message = messageMap.get(ordinal)
      return message
        ? getMessageRowType(message, messageTypeMap.get(ordinal))
        : (messageTypeMap.get(ordinal) ?? 'text')
    },
    [threadStore]
  )

  const insets = useSafeAreaInsets()

  const {scrollToCentered, scrollToBottom, onEndReached} = useNativeScrolling({
    centeredOrdinal: centeredOrdinalOrNone,
    conversationIDKey,
    listRef,
    messageOrdinals,
  })

  const jumpToRecent = Hooks.useJumpToRecent(scrollToBottom, messageOrdinals.length)

  const lastCenteredOrdinal = React.useRef(0)
  React.useEffect(() => {
    if (lastCenteredOrdinal.current === centeredOrdinalOrNone) {
      return
    }
    lastCenteredOrdinal.current = centeredOrdinalOrNone
    if (centeredOrdinalOrNone > 0) {
      const id = setTimeout(() => {
        scrollToCentered()
      }, 200)
      return () => {
        clearTimeout(id)
      }
    }
    return undefined
  }, [centeredOrdinalOrNone, scrollToCentered])

  const prevLoadedRef = React.useRef(false)
  const markedLoadedThreadRef = React.useRef(false)
  React.useLayoutEffect(() => {
    prevLoadedRef.current = false
    markedLoadedThreadRef.current = false
  }, [conversationIDKey])
  React.useLayoutEffect(() => {
    const justLoaded = loaded && !prevLoadedRef.current
    prevLoadedRef.current = loaded

    if (!justLoaded) return

    if (!markedLoadedThreadRef.current) {
      markedLoadedThreadRef.current = true
      markInitiallyLoadedThreadAsRead()
    }

    if (centeredOrdinalOrNone > 0) {
      scrollToCentered()
      setTimeout(() => {
        scrollToCentered()
      }, 100)
    } else if (numOrdinals > 0) {
      scrollToBottom()
      setTimeout(() => {
        scrollToBottom()
      }, 100)
    }
  }, [
    centeredOrdinalOrNone,
    loaded,
    markInitiallyLoadedThreadAsRead,
    numOrdinals,
    scrollToBottom,
    scrollToCentered,
  ])

  const onViewableItemsChanged = useNativeSafeOnViewableItemsChanged(onEndReached, messageOrdinals.length)

  const renderScrollComponent = React.useCallback(
    (props: ScrollViewProps) => (
      <KeyboardChatScrollView
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
        inverted={true}
        offset={insets.bottom}
        {...props}
      />
    ),
    [insets.bottom]
  )

  const nativeContentContainerStyle = React.useMemo(
    () => ({
      paddingBottom: 0,
      paddingTop: mobileTypingContainerHeight + insets.bottom,
    }),
    [insets.bottom]
  )

  return (
    <Kb.ErrorBoundary>
      <PerfProfiler id="MessageList">
        <Kb.Box2 direction="vertical" fullWidth={true} flex={1} relative={true}>
          <List
            key={conversationIDKey}
            testID="messageList"
            onScrollToIndexFailed={noop}
            estimatedItemSize={72}
            ListHeaderComponent={SpecialBottomMessage}
            ListFooterComponent={SpecialTopMessage}
            ItemSeparatorComponent={Separator}
            overScrollMode="never"
            contentContainerStyle={nativeContentContainerStyle}
            data={messageOrdinals}
            getItemType={getItemType}
            inverted={true}
            renderItem={renderItem}
            onViewableItemsChanged={onViewableItemsChanged.current}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            keyExtractor={keyExtractor}
            ref={listRef}
            renderScrollComponent={renderScrollComponent}
            maintainVisibleContentPosition={
              // MUST do this else if you come into a new thread it'll slowly scroll down when it loads
              numOrdinals ? maintainVisibleContentPosition : undefined
            }
          />
          {jumpToRecent}
          {debugWhichList}
        </Kb.Box2>
      </PerfProfiler>
    </Kb.ErrorBoundary>
  )
}

const minTimeDelta = 1000
const minDistanceFromEnd = 10

const useNativeSafeOnViewableItemsChanged = (onEndReached: () => void, numOrdinals: number) => {
  const nextCallbackRef = React.useRef(new Date().getTime())
  const onEndReachedRef = React.useRef(onEndReached)
  React.useEffect(() => {
    onEndReachedRef.current = onEndReached
  }, [onEndReached])
  const numOrdinalsRef = React.useRef(numOrdinals)
  React.useEffect(() => {
    numOrdinalsRef.current = numOrdinals
    nextCallbackRef.current = new Date().getTime() + minTimeDelta
  }, [numOrdinals])

  // this can't change ever, so we have to use refs to keep in sync
  const onViewableItemsChanged = React.useRef(
    ({viewableItems}: {viewableItems: Array<{index: number | null}>}) => {
      const idx = viewableItems.at(-1)?.index ?? 0
      const lastIdx = numOrdinalsRef.current - 1
      const offset = numOrdinalsRef.current > 50 ? minDistanceFromEnd : 1
      const deltaIdx = idx - lastIdx + offset
      // not far enough from the end
      if (deltaIdx < 0) {
        return
      }
      const t = new Date().getTime()
      const deltaT = t - nextCallbackRef.current
      // enough time elapsed?
      if (deltaT > 0) {
        nextCallbackRef.current = t + minTimeDelta
        onEndReachedRef.current()
      }
    }
  )
  return onViewableItemsChanged
}

export default isMobile ? NativeConversationList : DesktopThreadWrapperWithProfiler
