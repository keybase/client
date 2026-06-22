import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as T from '@/constants/types'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
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
  useConversationThreadMarkThreadAsRead,
  useConversationThreadSelector,
  useConversationThreadStore,
} from '../thread-context'
import {useJumpToRecent} from './jump-to-recent'
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
import {mobileTypingContainerHeight} from '../input-area/normal/typing'
import {
  KeyboardChatScrollView,
  useKeyboardState,
  useReanimatedKeyboardAnimation,
} from 'react-native-keyboard-controller'
import Animated, {useAnimatedStyle} from 'react-native-reanimated'
import {ThreadSearchOverlayContext} from '../thread-search-overlay-context'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
type ItemType = T.Chat.Ordinal

const noOrdinals: ReadonlyArray<T.Chat.Ordinal> = []

const keyExtractor = (ordinal: ItemType) => String(ordinal)

// trim off the search-bar lift so the jump button rests ~40px above the bar
const jumpAboveBarTrim = 40

// Item type for list recycling pool separation
const useGetItemType = () => {
  const threadStore = useConversationThreadStore()
  return React.useCallback(
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
}

// ==================== SHARED ====================

// Both platforms read the same slice of thread state.
const useThreadListData = () =>
  useConversationThreadSelector(
    C.useShallow(s => ({
      containsLatestMessage: !s.moreToLoadForward,
      loaded: s.loaded,
      messageOrdinals: s.messageOrdinals ?? noOrdinals,
    }))
  )

// Pagination: load older at the top of the list, newer at the bottom (only when not already at
// the latest). Refs keep the throttled callbacks stable.
const usePagination = (p: {
  containsLatestMessage: boolean
  messageOrdinals: ReadonlyArray<T.Chat.Ordinal>
}) => {
  const {containsLatestMessage, messageOrdinals} = p
  const loadOlderMessagesDueToScroll = useConversationThreadLoadOlderMessagesDueToScroll()
  const loadNewerMessagesDueToScroll = useConversationThreadLoadNewerMessagesDueToScroll()
  const getThreadLoadStatusOptions = useThreadLoadStatusOptionsGetter()

  const numOrdinalsRef = React.useRef(messageOrdinals.length)
  React.useEffect(() => {
    numOrdinalsRef.current = messageOrdinals.length
  }, [messageOrdinals.length])

  const containsLatestMessageRef = React.useRef(containsLatestMessage)
  React.useEffect(() => {
    containsLatestMessageRef.current = containsLatestMessage
  }, [containsLatestMessage])

  const onStartReached = React.useCallback(() => {
    loadOlderMessagesDueToScroll(numOrdinalsRef.current, getThreadLoadStatusOptions())
  }, [loadOlderMessagesDueToScroll, getThreadLoadStatusOptions])

  const onEndReached = C.useThrottledCallback(() => {
    if (!containsLatestMessageRef.current) {
      loadNewerMessagesDueToScroll(numOrdinalsRef.current, getThreadLoadStatusOptions())
    }
  }, 200)
  React.useEffect(
    () => () => {
      onEndReached.cancel()
    },
    [onEndReached]
  )

  return {onEndReached, onStartReached}
}

// When a centeredOrdinal is set at mount, start there; otherwise start at the end (newest).
const useInitialScrollIndex = (
  messageOrdinals: ReadonlyArray<T.Chat.Ordinal>,
  centeredOrdinal: T.Chat.Ordinal | undefined
) =>
  React.useMemo(() => {
    const idx =
      centeredOrdinal !== undefined
        ? sortedIndexOf(messageOrdinals as unknown as number[], centeredOrdinal as unknown as number)
        : -1
    return idx >= 0 ? ({index: idx, viewPosition: 0.5} as const) : undefined
  }, [messageOrdinals, centeredOrdinal])

// ==================== DESKTOP ====================

const HighlightableRow = React.memo(({ordinal}: {ordinal: T.Chat.Ordinal}) => {
  const {centeredHighlightOrdinal} = useConversationCenter()
  // derived boolean: raw s.editing would re-render every row on edit start/stop
  const isEditing = InputState.useConversationInput(s => s.editing === ordinal)
  const isHighlighted = centeredHighlightOrdinal === ordinal || isEditing
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
  const data = useThreadListData()
  const {centeredOrdinal} = useConversationCenter()
  const {containsLatestMessage, messageOrdinals, loaded} = data

  // LegendList deadlock fix: when initialScrollAtEnd=true, data must not arrive
  // before LegendList's internal ResizeObserver fires (sets queuedInitialLayout).
  // If data arrives first, handleInitialScrollDataChange returns early and
  // didFinishInitialScroll never becomes true, leaving readyToRender=false forever.
  // Delaying data by one rAF ensures layout fires before data is fed in.
  // We track which conversationIDKey has had its layout settle rather than using
  // a boolean state, so the reset on conversation change is derived (no synchronous
  // setState inside an effect).
  const [layoutReadyKey, setLayoutReadyKey] = React.useState('')
  const layoutReady = layoutReadyKey === conversationIDKey || centeredOrdinal !== undefined
  React.useEffect(() => {
    const id = requestAnimationFrame(() => {
      setLayoutReadyKey(conversationIDKey)
    })
    return () => cancelAnimationFrame(id)
  }, [conversationIDKey])

  const listRef = React.useRef<LegendListRef | null>(null)
  const wrapperRef = React.useRef<HTMLDivElement | null>(null)

  const markInitiallyLoadedThreadAsRead = useConversationThreadMarkThreadAsRead()

  const {onStartReached, onEndReached} = usePagination({containsLatestMessage, messageOrdinals})

  // messageOrdinalsRef feeds the imperative scroll-to-center / scroll-to-edit effects below.
  const messageOrdinalsRef = React.useRef(messageOrdinals)
  React.useEffect(() => {
    messageOrdinalsRef.current = messageOrdinals
  }, [messageOrdinals])

  const getItemType = useGetItemType()

  // Imperative scroll for ScrollContext
  const scrollToBottom = React.useCallback(() => {
    void listRef.current?.scrollToEnd({animated: false})
  }, [])

  const scrollUp = React.useCallback(() => {
    const state = listRef.current?.getState()
    if (!state) return
    void listRef.current?.scrollToOffset({
      animated: false,
      offset: Math.max(0, state.scroll - state.scrollLength),
    })
  }, [])

  const scrollDown = React.useCallback(() => {
    const state = listRef.current?.getState()
    if (!state) return
    void listRef.current?.scrollToOffset({
      animated: false,
      offset: state.scroll + state.scrollLength,
    })
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
        ;(
          wrapperRef.current as unknown as {
            classList: {remove: (c: string) => void}
          } | null
        )?.classList.remove('scroll-ignore-pointer')
      }, 200)
      if (!isScrollingRef.current) {
        isScrollingRef.current = true
        ;(
          wrapperRef.current as unknown as {
            classList: {add: (c: string) => void}
          } | null
        )?.classList.add('scroll-ignore-pointer')
      }
    },
    100,
    {leading: true, trailing: true}
  )
  React.useEffect(
    () => () => {
      onScroll.cancel()
      clearTimeout(scrollStopTimerRef.current)
    },
    [onScroll]
  )

  // Scroll to centered ordinal when it changes (search / thread navigation).
  // Use a "last scrolled to" ref rather than a "did it change" ref so we still
  // scroll when loaded becomes true after centeredOrdinal was already set.
  const lastScrolledCenteredRef = React.useRef<T.Chat.Ordinal | undefined>(undefined)
  React.useLayoutEffect(() => {
    lastScrolledCenteredRef.current = undefined
  }, [conversationIDKey])

  React.useEffect(() => {
    if (!loaded) return
    if (centeredOrdinal !== undefined) {
      if (lastScrolledCenteredRef.current === centeredOrdinal) return
      const idx = sortedIndexOf(
        messageOrdinalsRef.current as unknown as number[],
        centeredOrdinal as unknown as number
      )
      if (idx < 0) return
      lastScrolledCenteredRef.current = centeredOrdinal
      const target = centeredOrdinal
      const doScrollToCenter = async () => {
        for (let attempt = 0; attempt < 4; attempt++) {
          const el = (
            wrapperRef.current as unknown as {
              querySelector: (s: string) => {scrollIntoView: (o: object) => void} | null
            } | null
          )?.querySelector(`[data-ordinal="${target}"]`)
          if (el) {
            el.scrollIntoView({behavior: 'instant', block: 'center'})
            return
          }
          void listRef.current?.scrollToIndex({
            animated: false,
            index: idx,
            viewPosition: 0.5,
          })
          await new Promise<void>(resolve => setTimeout(resolve, 100))
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
    const idx = sortedIndexOf(
      messageOrdinalsRef.current as unknown as number[],
      editingOrdinal as unknown as number
    )
    if (idx >= 0) {
      void listRef.current?.scrollToIndex({
        animated: true,
        index: idx,
        viewPosition: 0.5,
      })
    }
  }, [editingOrdinal])

  // Mark thread as read after initial load (once per conversation)
  const markedReadRef = React.useRef(false)
  React.useLayoutEffect(() => {
    markedReadRef.current = false
  }, [conversationIDKey])

  const onLoad = React.useCallback(() => {
    if (!markedReadRef.current) {
      markedReadRef.current = true
      markInitiallyLoadedThreadAsRead()
    }
  }, [markInitiallyLoadedThreadAsRead])

  const renderItem = React.useCallback(
    ({item: ordinal}: {item: T.Chat.Ordinal}) => <HighlightableRow ordinal={ordinal} />,
    []
  )

  const jumpToRecent = useJumpToRecent(scrollToBottom, messageOrdinals.length)

  const {focusInput} = React.useContext(FocusContext)
  const handleListClick = (ev: React.MouseEvent) => {
    const target = ev.target as {
      closest?: (s: string) => unknown
      tagName?: string
    } | null
    const tagName = target?.tagName?.toUpperCase()
    if (tagName === 'INPUT' || tagName === 'TEXTAREA' || target?.closest?.('[data-search-filter="true"]'))
      return
    const sel = (
      globalThis as unknown as {
        getSelection?: () => {isCollapsed: boolean} | null
      }
    ).getSelection?.()
    if (sel?.isCollapsed) focusInput()
  }

  const onCopyCapture = (e: React.BaseSyntheticEvent) => {
    type DocGlobal = {
      createElement: (tag: string) => {
        appendChild: (n: unknown) => void
        querySelectorAll: (sel: string) => ArrayLike<{
          parentNode?: {
            removeChild?: (n: unknown) => void
            replaceChild?: (a: unknown, b: unknown) => void
          }
        }>
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

  const initialScrollIndex = useInitialScrollIndex(messageOrdinals, centeredOrdinal)

  return (
    <Kb.ErrorBoundary>
      <div
        data-testid={TestIDs.CHAT_MESSAGE_LIST}
        className="chat-message-list"
        style={Kb.Styles.castStyleDesktop(desktopStyles.container)}
        onClick={handleListClick}
        onCopyCapture={onCopyCapture}
        ref={wrapperRef}
      >
        <LegendList
          key={conversationIDKey}
          ref={listRef as React.Ref<LegendListRef>}
          data={(layoutReady ? messageOrdinals : noOrdinals) as unknown as T.Chat.Ordinal[]}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          getItemType={getItemType}
          ListHeaderComponent={SpecialTopMessage}
          ListFooterComponent={SpecialBottomMessage}
          recycleItems={true}
          drawDistance={250}
          estimatedItemSize={72}
          style={Kb.Styles.castStyleDesktop(desktopStyles.list)}
          initialScrollAtEnd={initialScrollIndex === undefined}
          initialScrollIndex={initialScrollIndex}
          maintainScrollAtEnd={
            centeredOrdinal !== undefined ? false : {on: {dataChange: true, itemLayout: true}}
          }
          maintainVisibleContentPosition={centeredOrdinal !== undefined ? undefined : {data: true}}
          onLoad={onLoad}
          onScroll={onScroll as unknown as (e: unknown) => void}
          onStartReached={onStartReached}
          onStartReachedThreshold={2}
          onEndReached={onEndReached}
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
          ...Kb.Styles.globalStyles.fillAbsolute,
          overflow: 'hidden',
        },
      }),
      list: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.size('100%'),
          outline: 'none',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          paddingBottom: 16,
          scrollbarGutter: 'stable',
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
  listRef: React.RefObject<RNFlatListRef | null>
}) => {
  const {listRef, centeredOrdinal, messageOrdinals} = p
  const numOrdinals = messageOrdinals.length
  const loadOlderMessages = useConversationThreadLoadOlderMessagesDueToScroll()
  const getThreadLoadStatusOptions = useThreadLoadStatusOptionsGetter()

  // KeyboardChatScrollView sets contentInset.top = K - insets.bottom and
  // contentOffset.y = -(K - insets.bottom) when keyboard is open. Scrolling to
  // offset=0 would place content K-insets.bottom pixels lower (behind the keyboard).
  // We compute the correct resting offset: keyboardHeight.value (negative) + insets.bottom.
  // When keyboard is closed keyboardHeight.value = 0 so the result is clamped to 0.
  const {height: keyboardAnimHeight} = useReanimatedKeyboardAnimation()
  const {bottom: insetsBottom} = useSafeAreaInsets()
  const scrollToBottom = React.useCallback(() => {
    const offset = Math.min(keyboardAnimHeight.value + insetsBottom, 0)
    listRef.current?.scrollToOffset({animated: false, offset})
  }, [insetsBottom, keyboardAnimHeight, listRef])

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
  // reset per centered target so each new search hit gets a fresh batch of retries
  const scrollFailRetryRef = React.useRef(0)
  React.useEffect(() => {
    centeredOrdinalRef.current = centeredOrdinal
    scrollFailRetryRef.current = 0
  }, [centeredOrdinal])
  const [scrollToCentered] = React.useState(() => () => {
    const co = centeredOrdinalRef.current
    if (lastScrollToCentered.current === co) {
      return
    }
    lastScrollToCentered.current = co
    // coarse: scrollToItem lands at the wrong offset for tall variable-height rows,
    // but it gets the target area rendered. The closed-loop corrector in the
    // component refines from there using the real viewable index range.
    const reassert = (delay: number) =>
      setTimeout(() => {
        const list = listRef.current
        const cur = centeredOrdinalRef.current
        if (!list || cur !== co || T.Chat.ordinalToNumber(cur) <= 0) {
          return
        }
        list.scrollToItem({animated: false, item: cur, viewPosition: 0.5})
      }, delay)
    ;[50, 250].forEach(reassert)
  })

  // The centered hit may be outside the rendered window, so scrollToItem fails
  // silently. Wait for more rows to render and retry centering (capped) until it lands.
  const [onScrollToIndexFailed] = React.useState(() => () => {
    if (scrollFailRetryRef.current > 5) {
      return
    }
    scrollFailRetryRef.current += 1
    setTimeout(() => {
      const co = centeredOrdinalRef.current
      if (T.Chat.ordinalToNumber(co) > 0) {
        listRef.current?.scrollToItem({animated: false, item: co, viewPosition: 0.5})
      }
    }, 200)
  })

  const onEndReached = () => {
    loadOlderMessages(numOrdinals, getThreadLoadStatusOptions())
  }

  return {
    onEndReached,
    onScrollToIndexFailed,
    scrollToBottom,
    scrollToCentered,
  }
}

// When the keyboard is open, KeyboardChatScrollView sets contentOffset.y = -(K-insets.bottom)
// (negative, inside contentInset.top). Two problems arise without special handling:
// 1. autoscrollToTopThreshold=1 fires (because -(K-I) <= 1) and scrolls to y=0, stripping the
//    keyboard offset and hiding new messages behind the keyboard.
// 2. maintainVisibleContentPosition adjusts contentOffset by the new message's height when it is
//    inserted, creating a visible gap between the newest message and the input area.
// Solution: disable MPV entirely when keyboard is visible. New messages appear naturally at the
// content-inset boundary (already in view), and a layout effect re-scrolls as a safety net.
const maintainVisibleContentPositionClosed = {
  autoscrollToTopThreshold: 1,
  minIndexForVisible: 0,
}

const NativeConversationList = function NativeConversationList() {
  const List = FlatList as unknown as React.ComponentType<
    Record<string, unknown> & {ref?: React.Ref<RNFlatListRef>}
  >

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
  const markInitiallyLoadedThreadAsRead = useConversationThreadMarkThreadAsRead()

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

  const getItemType = useGetItemType()

  const insets = useSafeAreaInsets()
  const isKeyboardVisible = useKeyboardState((s: {isVisible: boolean}) => s.isVisible)

  // While the thread-search bar is open it overlays the bottom of the list. Reserve
  // that height as extra content padding (so centered/newest messages clear it) and
  // lift the jump-to-recent button above both the keyboard and the bar.
  const searchOverlayHeight = React.useContext(ThreadSearchOverlayContext)
  const {height: keyboardAnimHeight} = useReanimatedKeyboardAnimation()
  const insetsBottom = insets.bottom
  // The search bar overlays the list bottom (keyboard closed) or rides the keyboard
  // top (keyboard open) via KeyboardStickyView; either way it sits above the list, so
  // always clear it. The keyboard term lifts past the keyboard, the bar term past the bar.
  const jumpLiftStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY:
          Math.min(keyboardAnimHeight.value + insetsBottom, 0) -
          Math.max((searchOverlayHeight?.value ?? 0) - jumpAboveBarTrim, 0),
      },
    ],
  }))

  const {scrollToCentered, scrollToBottom, onEndReached, onScrollToIndexFailed} = useNativeScrolling({
    centeredOrdinal: centeredOrdinalOrNone,
    listRef,
    messageOrdinals,
  })

  // Closed-loop centering corrector. scrollToItem/scrollToIndex lands at the wrong
  // offset here (inverted list + custom keyboard scrollview + tall variable-height
  // image rows), so instead we read the actual viewable index range each frame and
  // scrollToOffset by the item-delta until the target sits at viewport center.
  const scrollOffsetRef = React.useRef(0)
  const contentHeightRef = React.useRef(0)
  const centeredRef = React.useRef(centeredOrdinalOrNone)
  React.useEffect(() => {
    centeredRef.current = centeredOrdinalOrNone
  }, [centeredOrdinalOrNone])
  const ordsRef = React.useRef(messageOrdinals)
  React.useEffect(() => {
    ordsRef.current = messageOrdinals
  }, [messageOrdinals])
  // {active, iters}: correcting toward a centered hit and how many steps taken
  const correctRef = React.useRef({active: false, iters: 0})
  const vFirstRef = React.useRef<number | null | undefined>(undefined)
  const vLastRef = React.useRef<number | null | undefined>(undefined)
  const [correctCenter] = React.useState(
    () => (first: number | null | undefined, last: number | null | undefined) => {
      const st = correctRef.current
      if (!st.active) return
      const co = centeredRef.current
      const ords = ordsRef.current
      const num = ords.length
      if (co <= 0 || !num || first == null || last == null) return
      const targetIdx = ords.indexOf(co)
      if (targetIdx < 0) return
      const centerIdx = (first + last) / 2
      const diff = targetIdx - centerIdx
      if (Math.abs(diff) <= 0.5 || st.iters > 12) {
        st.active = false
        return
      }
      st.iters += 1
      const avgH = contentHeightRef.current / num
      // damp by 0.9 to avoid overshoot/oscillation; higher index = older = higher offset
      const newOffset = Math.max(0, scrollOffsetRef.current + diff * avgH * 0.9)
      listRef.current?.scrollToOffset({animated: false, offset: newOffset})
    }
  )
  const [onScrollNative] = React.useState(
    () =>
      (e: {nativeEvent: {contentOffset: {y: number}; contentSize: {height: number}}}) => {
        scrollOffsetRef.current = e.nativeEvent.contentOffset.y
        contentHeightRef.current = e.nativeEvent.contentSize.height
      }
  )
  const [onContentSizeChangeNative] = React.useState(() => (_w: number, h: number) => {
    contentHeightRef.current = h
  })
  // user touched the list: stop fighting them
  const [onScrollBeginDrag] = React.useState(() => () => {
    correctRef.current.active = false
  })

  const jumpToRecent = useJumpToRecent(scrollToBottom, messageOrdinals.length)

  // When keyboard is open, maintainVisibleContentPosition adjusts contentOffset by the new
  // message height when a message is added, undoing the scrollToBottom from onSubmit.
  // Defer the re-scroll past the native MPV adjustment (which runs on the UI thread after
  // React's commit) so the newest message stays visible.
  const prevNumOrdinalsRef = React.useRef(numOrdinals)
  // Tracks which conversation prevNumOrdinalsRef's baseline belongs to so the
  // baseline resets on a real conversation switch (value compare) rather than on
  // a react-native-screens freeze/thaw, which re-mounts effects.
  const numBaselineConvRef = React.useRef(conversationIDKey)
  const isKeyboardVisibleRef = React.useRef(isKeyboardVisible)
  React.useLayoutEffect(() => {
    isKeyboardVisibleRef.current = isKeyboardVisible
  })
  React.useLayoutEffect(() => {
    const sameConv = numBaselineConvRef.current === conversationIDKey
    numBaselineConvRef.current = conversationIDKey
    const prev = prevNumOrdinalsRef.current
    prevNumOrdinalsRef.current = numOrdinals
    if (sameConv && numOrdinals > prev && isKeyboardVisibleRef.current) {
      const id = setTimeout(() => {
        if (isKeyboardVisibleRef.current) {
          scrollToBottom()
        }
      }, 0)
      return () => clearTimeout(id)
    }
    return undefined
  }, [conversationIDKey, numOrdinals, scrollToBottom])

  // Center on the search hit once it actually appears in the loaded list. Centering
  // on the raw centeredOrdinal change is unreliable: navigating to a hit reloads the
  // thread centered on it, so messageOrdinals is briefly empty (idx -1) when the
  // ordinal changes. Wait for the target to load, then scroll (scrollToCentered
  // guards against repeats and re-asserts across frames).
  React.useEffect(() => {
    if (!(centeredOrdinalOrNone > 0 && messageOrdinals.includes(centeredOrdinalOrNone))) {
      return undefined
    }
    // coarse scroll to get the target area rendered, then run the closed-loop
    // corrector which refines via the real viewable index range
    scrollToCentered()
    correctRef.current = {active: true, iters: 0}
    const ids = [50, 250, 500, 900].map(d =>
      setTimeout(() => correctCenter(vFirstRef.current, vLastRef.current), d)
    )
    return () => {
      ids.forEach(clearTimeout)
    }
  }, [centeredOrdinalOrNone, messageOrdinals, scrollToCentered, correctCenter])

  // These refs store the conversation they last applied to (not a boolean) so a
  // freeze/thaw of this screen — which re-mounts effects without a real
  // conversation change — does not reset them and re-trigger the initial scroll,
  // which would lose the user's scroll position (e.g. returning from the info
  // panel). They reset implicitly when conversationIDKey changes.
  const loadedConvRef = React.useRef<string | undefined>(undefined)
  const markedConvRef = React.useRef<string | undefined>(undefined)
  React.useLayoutEffect(() => {
    const justLoaded = loaded && loadedConvRef.current !== conversationIDKey
    if (loaded) {
      loadedConvRef.current = conversationIDKey
    }

    if (!justLoaded) return

    if (markedConvRef.current !== conversationIDKey) {
      markedConvRef.current = conversationIDKey
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
    conversationIDKey,
    centeredOrdinalOrNone,
    loaded,
    markInitiallyLoadedThreadAsRead,
    numOrdinals,
    scrollToBottom,
    scrollToCentered,
  ])

  const onViewableItemsChanged = useNativeSafeOnViewableItemsChanged(onEndReached, messageOrdinals.length)
  const [onViewableItemsChangedNative] = React.useState(
    () => (info: {viewableItems: Array<{index: number | null}>}) => {
      onViewableItemsChanged.current(info)
      const first = info.viewableItems.at(0)?.index
      const last = info.viewableItems.at(-1)?.index
      vFirstRef.current = first
      vLastRef.current = last
      correctCenter(first, last)
    }
  )

  const renderScrollComponent = React.useCallback(
    (props: ScrollViewProps) => (
      <KeyboardChatScrollView
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
        inverted={true}
        offset={insets.bottom}
        extraContentPadding={searchOverlayHeight}
        {...props}
        scrollIndicatorInsets={{top: insets.bottom}}
      />
    ),
    [insets.bottom, searchOverlayHeight]
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
            testID={TestIDs.CHAT_MESSAGE_LIST}
            onScrollToIndexFailed={onScrollToIndexFailed}
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
            onViewableItemsChanged={onViewableItemsChangedNative}
            onScroll={onScrollNative}
            scrollEventThrottle={16}
            onContentSizeChange={onContentSizeChangeNative}
            onScrollBeginDrag={onScrollBeginDrag}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            keyExtractor={keyExtractor}
            ref={listRef}
            renderScrollComponent={renderScrollComponent}
            windowSize={3}
            maintainVisibleContentPosition={
              // MUST do this else if you come into a new thread it'll slowly scroll down when it loads
              // Disable MPV entirely when keyboard is visible: MPV's offset adjustment for newly
              // inserted messages conflicts with the keyboard-driven contentOffset.
              // Also disable while centered on a search hit: MPV's autoscroll-to-top yanks the
              // centered row, making the highlight land inconsistently.
              centeredOrdinalOrNone > 0 || !numOrdinals || isKeyboardVisible
                ? undefined
                : maintainVisibleContentPositionClosed
            }
          />
          {jumpToRecent && (
            <Animated.View style={[nativeStyles.jumpWrapper, jumpLiftStyle]} pointerEvents="box-none">
              {jumpToRecent}
            </Animated.View>
          )}
        </Kb.Box2>
      </PerfProfiler>
    </Kb.ErrorBoundary>
  )
}

const nativeStyles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      jumpWrapper: {
        bottom: 0,
        left: 0,
        position: 'absolute',
        right: 0,
      },
    }) as const
)

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
