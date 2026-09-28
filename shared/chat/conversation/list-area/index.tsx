import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as T from '@/constants/types'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import Separator, {NativeSeparator} from '../messages/separator'
import SpecialBottomMessage from '../messages/special-bottom-message'
import SpecialTopMessage from '../messages/special-top-message'
import {MessageRow} from '../messages/wrapper'
import {RowHoveredContext} from '../messages/ids-context'
import {PerfProfiler} from '@/perf/react-profiler'
import {ThreadRefsContext} from '../normal/context'
import {useConversationCenter} from '../center-context'
import {
  ShownUsernameCacheContext,
  useConversationThreadID,
  useConversationThreadLoadNewerMessagesDueToScroll,
  useConversationThreadLoadOlderMessagesDueToScroll,
  useConversationThreadMarkThreadAsRead,
  useConversationThreadSelector,
  useConversationThreadStore,
} from '../thread-context'
import {CatchUp, useCatchUp} from './catch-up'
import {useJumpToRecent} from './jump-to-recent'
import {useThreadLoadStatusOptionsGetter} from '../thread-load-status-context'
import {useDesktopThreadScroll} from './desktop-scroll'
import {useNativeThreadScroll, type NativeListRef} from './native-scroll'
import {getMessageRowType, getMessageShowUsername} from '../messages/row-metadata'
import {useCurrentUserState} from '@/stores/current-user'
import * as InputState from '../input-area/input-state'
import {copyToClipboard} from '@/util/storeless-actions'
import {LegendList} from '@legendapp/list/react'
import type {LegendListRef} from '@/common-adapters'
import {FlatList} from 'react-native'
import type {ScrollViewProps} from 'react-native'
import {mobileTypingContainerHeight} from '../input-area/normal/typing'
import {KeyboardChatScrollView, useKeyboardState} from 'react-native-keyboard-controller'
import Animated, {useAnimatedStyle} from 'react-native-reanimated'
import {ThreadSearchOverlayContext} from '../thread-search-overlay-context'
import {useComposerAnchor} from '../composer-viewport-context'
import {stickyTranslateY} from '../composer-geometry'
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

// Both platforms read the same slice of thread state.
const useThreadListData = () =>
  useConversationThreadSelector(
    C.useShallow(s => ({
      clearVersion: s.clearVersion,
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
  const data = useThreadListData()
  const {centeredOrdinal} = useConversationCenter()
  const {clearVersion, containsLatestMessage, messageOrdinals, loaded} = data

  // Centered loads (search hit, reply-quote jump, pinned message) clear the thread before
  // refetching, so the list sees a non-empty -> empty -> non-empty transition.
  const datasetKey = `${conversationIDKey}:${clearVersion}`

  const listRef = React.useRef<LegendListRef | null>(null)
  const wrapperRef = React.useRef<HTMLDivElement | null>(null)

  const markInitiallyLoadedThreadAsRead = useConversationThreadMarkThreadAsRead()

  const {onStartReached, onEndReached} = usePagination({containsLatestMessage, messageOrdinals})

  const getItemType = useGetItemType()

  const {initialScrollIndex, maintainScrollAtEnd, onKeyDown, onMetricsChange, onPointerDown, onWheel, scrollToBottom} =
    useDesktopThreadScroll({
      centeredOrdinal,
      datasetKey,
      editingOrdinal,
      listRef,
      loaded,
      messageOrdinals,
      wrapperRef,
    })

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

  const {onCatchUp, onViewableOrdinalsChanged, showCatchUp} = useCatchUp({loaded})
  // Data runs oldest-first here, so the first viewable row is the oldest one on screen.
  const onViewableItemsChanged = React.useCallback(
    (info: {viewableItems: ReadonlyArray<{item: T.Chat.Ordinal}>}) => {
      onViewableOrdinalsChanged(info.viewableItems.at(0)?.item)
    },
    [onViewableOrdinalsChanged]
  )

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

  return (
    <Kb.ErrorBoundary>
      <div
        data-testid={TestIDs.CHAT_MESSAGE_LIST}
        className="chat-message-list"
        style={Kb.Styles.castStyleDesktop(desktopStyles.container)}
        onClick={handleListClick}
        onCopyCapture={onCopyCapture}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
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
          // The documented boolean form, which enables every trigger. Naming any trigger in an
          // {on: {...}} list opts out of the ones left unnamed, and without the layout trigger a
          // window resize loses the end.
          maintainScrollAtEnd={maintainScrollAtEnd}
          // Stays on while centered: the full thread response lands after the cached one and
          // re-measures rows above the target, which slides it out of view unless anchored.
          maintainVisibleContentPosition={{data: true}}
          onMetricsChange={onMetricsChange}
          onLoad={onLoad}
          onScroll={onScroll as unknown as (e: unknown) => void}
          onStartReached={onStartReached}
          onStartReachedThreshold={2}
          onEndReached={onEndReached}
          onViewableItemsChanged={onViewableItemsChanged}
        />
        {jumpToRecent}
        {showCatchUp && <CatchUp onClick={onCatchUp} />}
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

const useInvertedMessageOrdinals = (messageOrdinals?: ReadonlyArray<T.Chat.Ordinal>) => {
  const source = messageOrdinals ?? noOrdinals
  return React.useMemo(() => (source.length > 1 ? [...source].reverse() : source), [source])
}

const NativeConversationList = function NativeConversationList() {
  const nativeStyles = useNativeStyles()
  const List = FlatList as unknown as React.ComponentType<
    Record<string, unknown> & {ref?: React.Ref<NativeListRef>}
  >

  const conversationIDKey = useConversationThreadID()
  const listData = useConversationThreadSelector(
    C.useShallow(s => ({
      clearVersion: s.clearVersion,
      loaded: s.loaded,
      messageOrdinals: s.messageOrdinals,
    }))
  )
  const {centeredHighlightOrdinal, centeredOrdinal} = useConversationCenter()
  const editingOrdinal = InputState.useConversationInput(s => s.editing)
  const noCenteredOrdinal = T.Chat.numberToOrdinal(-1)
  // Ordinals start at 1; this list takes anything else as no centre.
  const centeredTarget = centeredOrdinal !== undefined && centeredOrdinal > 0 ? centeredOrdinal : undefined
  const centeredHighlightOrdinalOrNone = centeredHighlightOrdinal ?? noCenteredOrdinal
  const {clearVersion, loaded} = listData

  const messageOrdinals = useInvertedMessageOrdinals(listData.messageOrdinals)

  const listRef = React.useRef<NativeListRef | null>(null)
  const markInitiallyLoadedThreadAsRead = useConversationThreadMarkThreadAsRead()
  const loadOlderMessages = useConversationThreadLoadOlderMessagesDueToScroll()
  const getThreadLoadStatusOptions = useThreadLoadStatusOptionsGetter()

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

  const {bottomInset, keyboardHeight, keyboardProgress} = useComposerAnchor()
  const isKeyboardVisible = useKeyboardState((s: {isVisible: boolean}) => s.isVisible)

  // While the thread-search bar is open it overlays the bottom of the list. Reserve
  // that height as extra content padding so centered/newest messages clear it.
  const searchOverlayHeight = React.useContext(ThreadSearchOverlayContext)
  // The input/search bar is translated above the list's layout bottom even when the
  // keyboard is closed. Mirror that exact translation here so the jump button always
  // rests on the bar's visual top edge instead of being clipped by it.
  const jumpLiftStyle = useAnimatedStyle(() => ({
    transform: [{translateY: stickyTranslateY(bottomInset, keyboardHeight.value, keyboardProgress.value)}],
  }))

  // Stores the conversation it last marked (not a boolean) so a freeze/thaw of this screen, which
  // re-mounts effects, does not mark it again. Declared ahead of the scroll adapter so a first load
  // is marked read before it scrolls.
  const markedConvRef = React.useRef<string | undefined>(undefined)
  React.useLayoutEffect(() => {
    if (loaded && markedConvRef.current !== conversationIDKey) {
      markedConvRef.current = conversationIDKey
      markInitiallyLoadedThreadAsRead()
    }
  }, [conversationIDKey, loaded, markInitiallyLoadedThreadAsRead])

  const {
    maintainVisibleContentPosition,
    onContentSizeChange,
    onScroll,
    onScrollBeginDrag,
    onScrollToIndexFailed,
    onViewableRange,
    scrollToBottom,
  } = useNativeThreadScroll({
    centeredOrdinal: centeredTarget,
    conversationIDKey,
    datasetKey: `${conversationIDKey}:${clearVersion}`,
    editingOrdinal,
    isKeyboardVisible,
    listRef,
    loaded,
    messageOrdinals,
  })

  const jumpToRecent = useJumpToRecent(scrollToBottom, messageOrdinals.length)

  const {onCatchUp, onViewableOrdinalsChanged, showCatchUp} = useCatchUp({loaded})

  const onEndReached = () => {
    loadOlderMessages(numOrdinals, getThreadLoadStatusOptions())
  }
  const onViewableItemsChanged = useNativeSafeOnViewableItemsChanged(onEndReached, messageOrdinals.length)
  const [onViewableItemsChangedNative] = React.useState(
    () => (info: {viewableItems: Array<{index: number | null; item: T.Chat.Ordinal}>}) => {
      onViewableItemsChanged.current(info)
      onViewableRange(info.viewableItems.at(0)?.index, info.viewableItems.at(-1)?.index)
      // The list is inverted and its data reversed, so the last viewable row is the oldest.
      onViewableOrdinalsChanged(info.viewableItems.at(-1)?.item)
    }
  )

  const renderScrollComponent = React.useCallback(
    (props: ScrollViewProps) => (
      <KeyboardChatScrollView
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
        inverted={true}
        offset={bottomInset}
        extraContentPadding={searchOverlayHeight}
        {...props}
        scrollIndicatorInsets={{top: bottomInset}}
      />
    ),
    [bottomInset, searchOverlayHeight]
  )

  const nativeContentContainerStyle = React.useMemo(
    () => ({
      paddingBottom: 0,
      paddingTop: mobileTypingContainerHeight + bottomInset,
    }),
    [bottomInset]
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
            ItemSeparatorComponent={NativeSeparator}
            overScrollMode="never"
            contentContainerStyle={nativeContentContainerStyle}
            data={messageOrdinals}
            getItemType={getItemType}
            inverted={true}
            renderItem={renderItem}
            onViewableItemsChanged={onViewableItemsChangedNative}
            onScroll={onScroll}
            scrollEventThrottle={16}
            onContentSizeChange={onContentSizeChange}
            onScrollBeginDrag={onScrollBeginDrag}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            keyExtractor={keyExtractor}
            ref={listRef}
            renderScrollComponent={renderScrollComponent}
            windowSize={3}
            maintainVisibleContentPosition={maintainVisibleContentPosition}
          />
          {jumpToRecent && (
            <Animated.View style={[nativeStyles.jumpWrapper, jumpLiftStyle]} pointerEvents="box-none">
              {jumpToRecent}
            </Animated.View>
          )}
          {showCatchUp && <CatchUp onClick={onCatchUp} />}
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
