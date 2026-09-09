import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as T from '@/constants/types'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import Separator from '../messages/separator'
import SpecialBottomMessage from '../messages/special-bottom-message'
import SpecialTopMessage from '../messages/special-top-message'
import {MessageRow} from '../messages/wrapper'
import {RowHoveredContext} from '../messages/ids-context'
import {PerfProfiler} from '@/perf/react-profiler'
import {ThreadRefsContext} from '../normal/context'
import {type CenterScrollAdapter, useConversationCenter, useConversationCenterScroll} from '../centering'
import {
  ShownUsernameCacheContext,
  useConversationThreadID,
  useConversationThreadMarkThreadAsRead,
  useConversationThreadStore,
} from '../thread-context'
import {useJumpToRecent} from './jump-to-recent'
import {useRequestWindow, useThreadWindow} from '../thread-window'
import {getMessageRowType, getMessageShowUsername} from '../messages/row-metadata'
import {useCurrentUserState} from '@/stores/current-user'
import * as InputState from '../input-area/input-state'
import sortedIndexOf from 'lodash/sortedIndexOf'
import {copyToClipboard} from '@/util/storeless-actions'
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
import Animated, {interpolate, useAnimatedStyle} from 'react-native-reanimated'
import {ThreadSearchOverlayContext} from '../thread-search-overlay-context'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
type ItemType = T.Chat.Ordinal

const noOrdinals: ReadonlyArray<T.Chat.Ordinal> = []

const keyExtractor = (ordinal: ItemType) => String(ordinal)

// Item type for list recycling pool separation. A message that leads its author group renders an
// avatar + username header (~40px taller) than a grouped follow-on of the same render type. Without
// splitting the pool, recycleItems reuses one container across both heights, so a recycled view
// paints at the wrong height for a frame before re-measure — visible as rows overlapping during
// scroll. Append ':hdr' so header and grouped rows pool separately. A row that reserves header
// space after a scroll-back load is as tall as a headered one, so it belongs in the same pool.
const useGetItemType = () => {
  const threadStore = useConversationThreadStore()
  const you = useCurrentUserState(s => s.username)
  // Must be the same sticky cache the rows render with (wrapper.tsx): without it, a row that keeps
  // its sticky header after a scroll-back load would be typed headerless here, mixing tall headered
  // rows into the headerless pool and poisoning that pool's height average.
  const shownCache = React.useContext(ShownUsernameCacheContext)
  return React.useCallback(
    (ordinal: T.Chat.Ordinal) => {
      if (!ordinal) {
        return 'null'
      }
      const {messageMap, messageTypeMap, messageOrdinals} = threadStore.getState()
      const message = messageMap.get(ordinal)
      if (!message) {
        return messageTypeMap.get(ordinal) ?? 'text'
      }
      const base = getMessageRowType(message, messageTypeMap.get(ordinal))
      const {reserveHeader, showUsername} = getMessageShowUsername({
        message,
        messageMap,
        messageOrdinals: messageOrdinals ?? noOrdinals,
        ordinal,
        shownCache,
        you,
      })
      return showUsername || reserveHeader ? `${base}:hdr` : base
    },
    [threadStore, you, shownCache]
  )
}

// ==================== SHARED ====================

// Pagination: load older at the top of the list, newer at the bottom. Whether either edge has more
// to fetch, and how fast the same edge may re-ask, is thread-window's business.
const usePagination = () => {
  const requestWindow = useRequestWindow()

  const onStartReached = React.useCallback(() => {
    requestWindow({anchor: 'older', reason: 'scroll back'})
  }, [requestWindow])

  const onEndReached = C.useThrottledCallback(() => {
    requestWindow({anchor: 'newer', reason: 'scroll forward'})
  }, 200)
  React.useEffect(
    () => () => {
      onEndReached.cancel()
    },
    [onEndReached]
  )

  return {onEndReached, onStartReached}
}

const centerTolerancePx = 8
// Native measures in index space, so its deadband is half a row and its steps are damped to keep an
// inverted list of tall image rows from oscillating around the target.
const nativeCenterDamping = 0.9
const maxNativeCenterCorrections = 12
const maxStaleRangeReads = 3
const maxScrollToIndexRetries = 5
// A scroller within this many pixels of its end counts as at the end.
const endTolerancePx = 2

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

  // Freeze the highlight into its end state once the fade has played, so a later DOM move cannot
  // restart it (see .highlight-settled in conversation.css). Keyed on the highlighted ordinal
  // because rows are recycled: the same node renders a different message over time.
  const [settledFor, setSettledFor] = React.useState<T.Chat.Ordinal | undefined>(undefined)
  const isSettled = isHighlighted && settledFor === ordinal
  const onAnimationEnd = React.useCallback(
    (e: React.AnimationEvent) => {
      // animationend bubbles; only this row's own fade should freeze it.
      if (e.animationName === 'highlightAnimation' && e.target === e.currentTarget) {
        setSettledFor(ordinal)
      }
    },
    [ordinal]
  )
  if (settledFor !== undefined && !isHighlighted) {
    setSettledFor(undefined)
  }

  // Defer hover-only UI (emoji row) until the pointer has entered this row. Keyed on the
  // ordinal because rows are recycled: a recycled row must not inherit the old hover.
  const [hoveredFor, setHoveredFor] = React.useState<T.Chat.Ordinal | undefined>(undefined)
  if (hoveredFor !== undefined && hoveredFor !== ordinal) {
    setHoveredFor(undefined)
  }
  const hovered = hoveredFor === ordinal

  return (
    <div
      data-ordinal={ordinal}
      onAnimationEnd={onAnimationEnd}
      onMouseEnter={hovered ? undefined : () => setHoveredFor(ordinal)}
      className={Kb.Styles.classNames(
        'hover-container',
        'WrapperMessage',
        'WrapperMessage-hoverBox',
        'WrapperMessage-decorated',
        'WrapperMessage-hoverColor',
        {highlighted: isHighlighted, 'highlight-settled': isSettled}
      )}
    >
      <RowHoveredContext value={hovered}>
        <Separator trailingItem={ordinal} />
        <MessageRow isCenteredHighlight={centeredHighlightOrdinal === ordinal} ordinal={ordinal} />
      </RowHoveredContext>
    </div>
  )
})
HighlightableRow.displayName = 'HighlightableRow'

const DesktopThreadWrapper = function DesktopThreadWrapper() {
  const desktopStyles = useDesktopStyles()
  const editingOrdinal = InputState.useConversationInput(s => s.editing)
  const conversationIDKey = useConversationThreadID()
  const {generation, ordinals: messageOrdinals} = useThreadWindow()
  const {centeredOrdinal, hasCenter} = useConversationCenter()

  // Centered loads (search hit, reply-quote jump, pinned message) clear the thread before
  // refetching, so the list sees a non-empty -> empty -> non-empty transition.
  const datasetKey = `${conversationIDKey}:${generation}`

  const listRef = React.useRef<LegendListRef | null>(null)
  const wrapperRef = React.useRef<HTMLDivElement | null>(null)

  const markInitiallyLoadedThreadAsRead = useConversationThreadMarkThreadAsRead()

  const {onStartReached, onEndReached} = usePagination()

  // messageOrdinalsRef feeds the imperative scroll-to-center / scroll-to-edit effects below.
  const messageOrdinalsRef = React.useRef(messageOrdinals)
  React.useEffect(() => {
    messageOrdinalsRef.current = messageOrdinals
  }, [messageOrdinals])

  const getItemType = useGetItemType()

  // Asks the scroller, not the list's own isAtEnd: that flag comes from the content size and viewport
  // the list has recorded, and both lag a composer collapse, so it reads not-at-end while the scroller
  // is in fact at its end.
  const isScrolledToEnd = React.useCallback(() => {
    type ElLike = {children: ArrayLike<ElLike>; clientHeight: number; scrollHeight: number; scrollTop: number}
    const wrapper = wrapperRef.current as unknown as ElLike | null
    if (!wrapper) return false
    for (const child of Array.from(wrapper.children)) {
      if (child.scrollHeight - child.clientHeight > 1) {
        return child.scrollHeight - child.clientHeight - child.scrollTop <= endTolerancePx
      }
    }
    return false
  }, [])

  // Who owns the scroll offset - the end, the centering loop, or the reader - is the centering
  // module's state now. initialScrollAtEnd starts it ours; a wheel, a keyboard scroll or a centered
  // load hands it over.
  const {endMayHaveMoved, readerTookScroll, registerAdapter, takeEndAnchor} = useConversationCenterScroll()
  React.useLayoutEffect(() => {
    takeEndAnchor()
  }, [datasetKey, takeEndAnchor])

  // Imperative scroll for ThreadRefsContext: for coming back from somewhere else in the thread, which
  // is the only case that needs it. While the list is at the end maintainScrollAtEnd owns the position,
  // and scrolling here only displaces it — the target resolves before the new row has measured, so it
  // lands short, and while it counts as in flight the list declines its own end anchor and abandons it.
  const scrollToBottom = React.useCallback(() => {
    takeEndAnchor()
    if (isScrolledToEnd()) return
    void listRef.current?.scrollToEnd({animated: false})
  }, [isScrolledToEnd, takeEndAnchor])

  const scrollUp = React.useCallback(() => {
    const state = listRef.current?.getState()
    if (!state) return
    readerTookScroll()
    void listRef.current?.scrollToOffset({
      animated: false,
      offset: Math.max(0, state.scroll - state.scrollLength),
    })
  }, [readerTookScroll])

  const scrollDown = React.useCallback(() => {
    const state = listRef.current?.getState()
    if (!state) return
    void listRef.current?.scrollToOffset({
      animated: false,
      offset: state.scroll + state.scrollLength,
    })
  }, [])

  // The header's own size change is the signal; the centering module decides whether the end is
  // still ours to hold and runs the correction.
  const lastHeaderSizeRef = React.useRef<number | undefined>(undefined)
  React.useLayoutEffect(() => {
    lastHeaderSizeRef.current = undefined
  }, [datasetKey])
  const onMetricsChange = React.useCallback(
    (metrics: {headerSize: number}) => {
      const previous = lastHeaderSizeRef.current
      lastHeaderSizeRef.current = metrics.headerSize
      // The first emit is the measurement the target was built from, not a change.
      if (previous === undefined || previous === metrics.headerSize) return
      endMayHaveMoved()
    },
    [endMayHaveMoved]
  )

  const {setScrollRef} = React.useContext(ThreadRefsContext)
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

  // The desktop half of the centering module's scroll adapter. LegendList owns the offset, so every
  // correction goes through its own scrollToOffset, never scrollIntoView: touching scrollTop
  // directly desyncs LegendList's internal scroll state, and the next time it recomputes item
  // positions it snaps somewhere unrelated.
  const adapter = React.useMemo<CenterScrollAdapter>(
    () => ({
      endAnchor: {
        read: () => {
          const state = listRef.current?.getState()
          return state ? {isAtEnd: state.isAtEnd, scroll: state.scroll} : undefined
        },
        scrollToEnd: () => {
          void listRef.current?.scrollToEnd({animated: false})
        },
      },
      measureTarget: ordinal => {
        type ElLike = {getBoundingClientRect: () => {height: number; top: number}}
        const wrapper = wrapperRef.current as unknown as
          | (ElLike & {querySelector: (s: string) => ElLike | null})
          | null
        const el = wrapper ? wrapper.querySelector(`[data-ordinal="${ordinal}"]`) : null
        if (!wrapper || !el) return {kind: 'offscreen'}
        const scroll = listRef.current?.getState().scroll
        if (scroll === undefined) return {kind: 'pending'}
        const elRect = el.getBoundingClientRect()
        const wrapRect = wrapper.getBoundingClientRect()
        return {
          kind: 'measured',
          offBy: elRect.top + elRect.height / 2 - (wrapRect.top + wrapRect.height / 2),
          scroll,
          tolerance: centerTolerancePx,
        }
      },
      scrollToIndex: ordinal => {
        const idx = sortedIndexOf(
          messageOrdinalsRef.current as unknown as number[],
          ordinal as unknown as number
        )
        if (idx >= 0) {
          void listRef.current?.scrollToIndex({animated: false, index: idx, viewPosition: 0.5})
        }
      },
      scrollToOffset: offset => {
        void listRef.current?.scrollToOffset({animated: false, offset})
      },
    }),
    []
  )
  React.useEffect(() => {
    registerAdapter(adapter)
    return () => {
      registerAdapter(undefined)
    }
  }, [adapter, registerAdapter])

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

  const {focusInput} = React.useContext(ThreadRefsContext)
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

  // A wheel means the user took over: stop centering so we don't scroll them away from where
  // they landed, and give up the end anchor.
  const onWheel = React.useCallback(() => {
    readerTookScroll()
  }, [readerTookScroll])

  return (
    <Kb.ErrorBoundary>
      <div
        data-testid={TestIDs.CHAT_MESSAGE_LIST}
        className="chat-message-list"
        style={Kb.Styles.castStyleDesktop(desktopStyles.container)}
        onClick={handleListClick}
        onCopyCapture={onCopyCapture}
        onWheel={onWheel}
        ref={wrapperRef}
      >
        <LegendList
          dataKey={datasetKey}
          ref={listRef as React.Ref<LegendListRef>}
          data={messageOrdinals as unknown as T.Chat.Ordinal[]}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          getItemType={getItemType}
          ListHeaderComponent={SpecialTopMessage}
          ListFooterComponent={SpecialBottomMessage}
          recycleItems={true}
          // Rows never paint at a provisional size: a recycled view waits for its real measurement
          // instead of flashing the pool's average height. Costs one extra render per recycled row.
          experimental_hideItemsUntilMeasured={true}
          drawDistance={250}
          estimatedItemSize={72}
          style={Kb.Styles.castStyleDesktop(desktopStyles.list)}
          // Short threads sit at the bottom rather than the top. Inert once the content is taller than
          // the viewport: the padding it adds is max(0, viewport - content).
          alignItemsAtEnd={true}
          initialScrollAtEnd={initialScrollIndex === undefined}
          initialScrollIndex={initialScrollIndex}
          maintainScrollAtEnd={
            hasCenter
              ? false
              : // The documented form, which enables every trigger. It was a narrowed {on: {...}} list
                // before, and naming any trigger opts out of the ones left unnamed — that is how the
                // layout trigger went missing and a window resize lost the end.
                true
          }
          // Stays on while centered: the full thread response lands after the cached one and
          // re-measures rows above the target, which slides it out of view unless anchored.
          maintainVisibleContentPosition={{data: true}}
          onMetricsChange={onMetricsChange}
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

const useDesktopStyles = Kb.Styles.createStyleHook(
  () =>
    ({
      container: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.globalStyles.fillAbsolute,
          overflow: 'hidden',
          // The gap above the input lives out here, not as the list's own paddingBottom: the list
          // feeds its padding into every scroll-offset calculation it makes (content size, the end
          // target, the at-end threshold), so keeping it outside the scroller keeps that math on
          // message sizes alone. Deliberately 8 rather than the 16 it used to be — half the gap reads
          // better with the messages sitting closer to the composer.
          paddingBottom: 8,
        },
      }),
      list: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.size('100%'),
          outline: 'none',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
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

const useInvertedMessageOrdinals = (source: ReadonlyArray<T.Chat.Ordinal>) =>
  React.useMemo(() => (source.length > 1 ? [...source].reverse() : source), [source])

const useNativeScrolling = (p: {listRef: React.RefObject<RNFlatListRef | null>}) => {
  const {listRef} = p
  const requestWindow = useRequestWindow()

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

  const {setScrollRef} = React.useContext(ThreadRefsContext)
  React.useEffect(() => {
    setScrollRef({scrollDown: noop, scrollToBottom, scrollUp: noop})
  }, [setScrollRef, scrollToBottom])

  const onEndReached = () => {
    requestWindow({anchor: 'older', reason: 'scroll back'})
  }

  return {onEndReached, scrollToBottom}
}

// The maintainVisibleContentPosition prop must ALWAYS be set (never toggled to undefined):
// RN Fabric only re-snapshots the MVP anchor while the prop is set, so an unset->set
// transition adjusts contentOffset against a stale anchor frame from before the prop was
// unset — a spurious jump + autoscroll animation of the whole list (seen after dismissing
// the keyboard following a send). Instead we swap between two configs:
// - closed (keyboard hidden): autoscrollToTopThreshold=1 so new messages at the bottom
//   auto-reveal when the user is pinned there.
// - noAutoscroll (keyboard open, or centered on a search hit, or empty list): MVP still
//   anchors content, but autoscroll-to-top is off because:
//   1. with the keyboard open contentOffset.y = -(K-insets.bottom) <= 1, so the threshold
//      would fire on insert and scroll to y=0, hiding new messages behind the keyboard.
//   2. while centered on a search hit, autoscroll yanks the centered row.
//   With the keyboard open, MVP's insert adjustment briefly holds old content in place;
//   the deferred scrollToBottom layout effect below re-pins the newest message.
const maintainVisibleContentPositionClosed = {
  autoscrollToTopThreshold: 1,
  minIndexForVisible: 0,
}
const maintainVisibleContentPositionNoAutoscroll = {
  minIndexForVisible: 0,
}

const NativeConversationList = function NativeConversationList() {
  const nativeStyles = useNativeStyles()
  const List = FlatList as unknown as React.ComponentType<
    Record<string, unknown> & {ref?: React.Ref<RNFlatListRef>}
  >

  const conversationIDKey = useConversationThreadID()
  const {loaded, ordinals} = useThreadWindow()
  const {centeredHighlightOrdinal, centeredOrdinal, hasCenter} = useConversationCenter()
  const noCenteredOrdinal = T.Chat.numberToOrdinal(-1)
  const centeredOrdinalOrNone = centeredOrdinal ?? noCenteredOrdinal
  const centeredHighlightOrdinalOrNone = centeredHighlightOrdinal ?? noCenteredOrdinal

  const messageOrdinals = useInvertedMessageOrdinals(ordinals)

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
  // that height as extra content padding so centered/newest messages clear it.
  const searchOverlayHeight = React.useContext(ThreadSearchOverlayContext)
  const {height: keyboardAnimHeight, progress: keyboardProgress} = useReanimatedKeyboardAnimation()
  const insetsBottom = insets.bottom
  // The input/search bar lives in a KeyboardStickyView with offset
  // {closed: -insets.bottom, opened: 0}, so it's translated above the list's layout
  // bottom even when the keyboard is closed. Mirror that exact translation here so the
  // jump button always rests on the bar's visual top edge instead of being clipped by it.
  const jumpLiftStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY:
          keyboardAnimHeight.value + interpolate(keyboardProgress.value, [0, 1], [-insetsBottom, 0]),
      },
    ],
  }))

  const {scrollToBottom, onEndReached} = useNativeScrolling({listRef})

  // The native half of the centering module's scroll adapter. scrollToItem/scrollToIndex lands at
  // the wrong offset here (inverted list + custom keyboard scrollview + tall variable-height image
  // rows), so the measurement is taken in index space instead - the real viewable range against the
  // target's index - and converted to pixels with the average row height.
  const scrollOffsetRef = React.useRef(0)
  const contentHeightRef = React.useRef(0)
  const ordsRef = React.useRef(messageOrdinals)
  React.useEffect(() => {
    ordsRef.current = messageOrdinals
  }, [messageOrdinals])
  const vFirstRef = React.useRef<number | null | undefined>(undefined)
  const vLastRef = React.useRef<number | null | undefined>(undefined)
  // The viewable range only updates when the list reports one, and correcting twice off the same
  // reading overshoots. Bounded, though: a scroll that moves nothing never produces a new range,
  // and the corrector has to be allowed to see that it moved nothing.
  const rangeVersionRef = React.useRef(0)
  const consumedRangeRef = React.useRef(-1)
  const staleRangeReadsRef = React.useRef(0)
  const {readerTookScroll, registerAdapter} = useConversationCenterScroll()
  const adapter = React.useMemo<CenterScrollAdapter>(
    () => ({
      maxCorrections: maxNativeCenterCorrections,
      measureTarget: ordinal => {
        const ords = ordsRef.current
        const num = ords.length
        const targetIdx = ords.indexOf(ordinal)
        if (!num || targetIdx < 0) return {kind: 'offscreen'}
        const first = vFirstRef.current
        const last = vLastRef.current
        if (first == null || last == null) return {kind: 'pending'}
        if (rangeVersionRef.current === consumedRangeRef.current) {
          staleRangeReadsRef.current += 1
          if (staleRangeReadsRef.current <= maxStaleRangeReads) return {kind: 'pending'}
        }
        staleRangeReadsRef.current = 0
        const centerIdx = (first + last) / 2
        const diff = targetIdx - centerIdx
        const avgH = contentHeightRef.current / num
        return {
          kind: 'measured',
          // higher index = older = higher offset, damped to avoid overshoot/oscillation
          offBy: diff * avgH * nativeCenterDamping,
          scroll: scrollOffsetRef.current,
          // half a row, expressed through the same damping so the deadband stays the index-space
          // half-row it has always been
          tolerance: 0.5 * avgH * nativeCenterDamping,
        }
      },
      scrollToIndex: ordinal => {
        if (T.Chat.ordinalToNumber(ordinal) <= 0) return
        consumedRangeRef.current = rangeVersionRef.current
        staleRangeReadsRef.current = 0
        listRef.current?.scrollToItem({animated: false, item: ordinal, viewPosition: 0.5})
      },
      scrollToOffset: offset => {
        consumedRangeRef.current = rangeVersionRef.current
        staleRangeReadsRef.current = 0
        listRef.current?.scrollToOffset({animated: false, offset: Math.max(0, offset)})
      },
    }),
    []
  )
  React.useEffect(() => {
    registerAdapter(adapter)
    return () => {
      registerAdapter(undefined)
    }
  }, [adapter, registerAdapter])

  // The centered hit may be outside the rendered window, so scrollToItem fails silently. Wait for
  // more rows to render and retry (capped) until it lands; reset per target so each new search hit
  // gets a fresh batch of retries.
  const centeredRef = React.useRef(centeredOrdinalOrNone)
  const scrollFailRetryRef = React.useRef(0)
  React.useEffect(() => {
    centeredRef.current = centeredOrdinalOrNone
    scrollFailRetryRef.current = 0
  }, [centeredOrdinalOrNone])
  const [onScrollToIndexFailed] = React.useState(() => () => {
    if (scrollFailRetryRef.current > maxScrollToIndexRetries) {
      return
    }
    scrollFailRetryRef.current += 1
    setTimeout(() => {
      adapter.scrollToIndex(centeredRef.current)
    }, 200)
  })

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
  const onScrollBeginDrag = React.useCallback(() => {
    readerTookScroll()
  }, [readerTookScroll])

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

    // A centered thread is the centering module's to steer.
    if (!hasCenter && numOrdinals > 0) {
      scrollToBottom()
      setTimeout(() => {
        scrollToBottom()
      }, 100)
    }
  }, [conversationIDKey, hasCenter, loaded, markInitiallyLoadedThreadAsRead, numOrdinals, scrollToBottom])

  const onViewableItemsChanged = useNativeSafeOnViewableItemsChanged(onEndReached, messageOrdinals.length)
  const [onViewableItemsChangedNative] = React.useState(
    () => (info: {viewableItems: Array<{index: number | null}>}) => {
      onViewableItemsChanged.current(info)
      vFirstRef.current = info.viewableItems.at(0)?.index
      vLastRef.current = info.viewableItems.at(-1)?.index
      rangeVersionRef.current += 1
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

  const mvpAutoscroll = !(hasCenter || !numOrdinals || isKeyboardVisible)

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
              mvpAutoscroll
                ? maintainVisibleContentPositionClosed
                : maintainVisibleContentPositionNoAutoscroll
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

const useNativeStyles = Kb.Styles.createStyleHook(
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
