import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import type * as T from '@/constants/types'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import Separator from '../messages/separator'
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
import {useJumpToRecent} from './jump-to-recent'
import {useThreadLoadStatusOptionsGetter} from '../thread-load-status-context'
import {getMessageRowType, getMessageShowUsername} from '../messages/row-metadata'
import {useCurrentUserState} from '@/stores/current-user'
import * as InputState from '../input-area/input-state'
import sortedIndexOf from 'lodash/sortedIndexOf'
import {copyToClipboard} from '@/util/storeless-actions'
import noop from 'lodash/noop'
import {LegendList} from '@legendapp/list/react'
import type {LegendListRef} from '@/common-adapters'
import {mobileTypingContainerHeight} from '../input-area/normal/typing'
import {
  KeyboardAwareLegendList,
  useKeyboardScrollToEnd,
} from '@legendapp/list/keyboard'
import {useReanimatedKeyboardAnimation} from 'react-native-keyboard-controller'
import Animated, {interpolate, useAnimatedReaction, useAnimatedStyle} from 'react-native-reanimated'
import {scheduleOnRN} from 'react-native-worklets'
import {ThreadSearchOverlayContext} from '../thread-search-overlay-context'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
type ItemType = T.Chat.Ordinal

const noOrdinals: ReadonlyArray<T.Chat.Ordinal> = []

// Stable config so it doesn't churn props each render. Empty = enable adaptive render with defaults.
const adaptiveRenderConfig = {}

// Stable MVCP config (anchor visible rows across data prepends). Referenced by native; desktop
// inlines an equivalent.
const mvcpData = {data: true} as const

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

// Sending the list to the centered ordinal: a search hit, a reply-quote jump, a pinned message.
//
// Centring on the raw ordinal change is unreliable: navigating to a hit reloads the thread centred
// on it, so the target is briefly absent from messageOrdinals when the ordinal changes. Wait for it
// to arrive, then scroll once per target and no more. Re-issuing when the target's index moves looks
// reasonable - a prepend does shift it - but scrolling is what triggers that prepend, so it would
// re-centre the list out from under someone reading around the hit. The list holds the target in
// place while rows measure, and maintainVisibleContentPosition holds it across prepends.
//
// Reset per dataset rather than per conversation: re-centring on the ordinal already stored still
// clears and reloads the thread, so the list has to be sent to it again.
const useScrollToCentered = (p: {
  centeredOrdinal: T.Chat.Ordinal | undefined
  datasetKey: string
  listRef: React.RefObject<LegendListRef | null>
  messageOrdinals: ReadonlyArray<T.Chat.Ordinal>
  ready: boolean
}) => {
  const {centeredOrdinal, datasetKey, listRef, messageOrdinals, ready} = p
  const lastScrolledRef = React.useRef<T.Chat.Ordinal | undefined>(undefined)
  React.useLayoutEffect(() => {
    lastScrolledRef.current = undefined
  }, [datasetKey])

  // Unconditional on purpose. A guard that stood this call down while the list's own
  // initialScrollIndex bootstrap looked like it owned the target was tried and measured against the
  // app, and there is no version of it that is safe: on the permalink path the thread mounts with no
  // centred target, so the list is built with initialScrollAtEnd, and the bootstrap it re-arms when
  // the centred dataset lands does not move it - the thread settles at its end with the target never
  // shown. That path is indistinguishable from a warm in-thread jump by anything visible here (both
  // arrive as "dataset with a resolvable initialScrollIndex"), so this call has to be the one
  // authority that always fires.
  React.useEffect(() => {
    if (!ready || centeredOrdinal === undefined) {
      lastScrolledRef.current = undefined
      return
    }
    if (lastScrolledRef.current === centeredOrdinal) return
    if (sortedIndexOf(messageOrdinals as unknown as number[], centeredOrdinal as unknown as number) < 0) {
      return
    }
    lastScrolledRef.current = centeredOrdinal
    void listRef.current?.scrollToItem({animated: false, item: centeredOrdinal, viewPosition: 0.5})
  }, [centeredOrdinal, datasetKey, listRef, messageOrdinals, ready])
}

const DesktopThreadWrapper = function DesktopThreadWrapper() {
  const desktopStyles = useDesktopStyles()
  const editingOrdinal = InputState.useConversationInput(s => s.editing)
  const conversationIDKey = useConversationThreadID()
  const data = useThreadListData()
  const {centeredOrdinal} = useConversationCenter()
  const {clearVersion, containsLatestMessage, messageOrdinals, loaded} = data

  // Centered loads (search hit, reply-quote jump, pinned message) clear the thread before
  // refetching, so the list sees a non-empty -> empty -> non-empty transition it cannot recover
  // from on its own. dataKey tells it the data is a new dataset, which is what makes it reset
  // rather than wait for a container layout that never comes.
  const datasetKey = `${conversationIDKey}:${clearVersion}`

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

  // Imperative scroll for ThreadRefsContext: for coming back from somewhere else in the thread, which
  // is the only case that needs it. While the list is at the end maintainScrollAtEnd owns the position,
  // and scrolling here only displaces it — the target resolves before the new row has measured, so it
  // lands short, and while it counts as in flight the list declines its own end anchor and abandons it.
  const scrollToBottom = React.useCallback(() => {
    if (isScrolledToEnd()) return
    void listRef.current?.scrollToEnd({animated: false})
  }, [isScrolledToEnd])

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

  useScrollToCentered({centeredOrdinal, datasetKey, listRef, messageOrdinals, ready: loaded})

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
          dataKey={datasetKey}
          ref={listRef as React.Ref<LegendListRef>}
          data={messageOrdinals as unknown as T.Chat.Ordinal[]}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          getItemType={getItemType}
          ListHeaderComponent={SpecialTopMessage}
          ListFooterComponent={SpecialBottomMessage}
          recycleItems={true}
          drawDistance={250}
          estimatedItemSize={72}
          style={Kb.Styles.castStyleDesktop(desktopStyles.list)}
          // Short threads sit at the bottom rather than the top. Inert once the content is taller than
          // the viewport: the padding it adds is max(0, viewport - content).
          alignItemsAtEnd={true}
          initialScrollAtEnd={initialScrollIndex === undefined}
          initialScrollIndex={initialScrollIndex}
          maintainScrollAtEnd={
            centeredOrdinal !== undefined
              ? false
              : // The documented form, which enables every trigger. It was a narrowed {on: {...}} list
                // before, and naming any trigger opts out of the ones left unnamed — that is how the
                // layout trigger went missing and a window resize lost the end.
                true
          }
          // Stays on while centered: the full thread response lands after the cached one and
          // re-measures rows above the target, which slides it out of view unless anchored.
          maintainVisibleContentPosition={{data: true}}
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

const useNativeScrolling = (p: {
  scrollMessageToEnd: (o: {animated: boolean; closeKeyboard: boolean}) => Promise<void>
}) => {
  const {scrollMessageToEnd} = p

  // scrollMessageToEnd freezes the keyboard-aware scroll view, scrolls to the end,
  // then unfreezes — so the newest message stays pinned above the input bar even
  // while the keyboard is open.
  const scrollToBottom = React.useCallback(() => {
    void scrollMessageToEnd({animated: false, closeKeyboard: false})
  }, [scrollMessageToEnd])

  const {setScrollRef} = React.useContext(ThreadRefsContext)
  React.useEffect(() => {
    setScrollRef({scrollDown: noop, scrollToBottom, scrollUp: noop})
  }, [setScrollRef, scrollToBottom])

  return {
    scrollToBottom,
  }
}

// Reads the centered highlight itself (like desktop's HighlightableRow) so renderItem stays
// referentially stable — a renderItem identity change re-renders every visible row at once.
const NativeRow = React.memo(function NativeRow({ordinal}: {ordinal: T.Chat.Ordinal}) {
  const {centeredHighlightOrdinal} = useConversationCenter()
  return (
    <>
      <Separator trailingItem={ordinal} />
      <MessageRow isCenteredHighlight={centeredHighlightOrdinal === ordinal} ordinal={ordinal} />
    </>
  )
})

const nativeRenderItem = ({item: ordinal}: {item: T.Chat.Ordinal}) => <NativeRow ordinal={ordinal} />

const NativeConversationList = function NativeConversationList() {
  const nativeStyles = useNativeStyles()
  const conversationIDKey = useConversationThreadID()
  const listData = useThreadListData()
  const {centeredOrdinal} = useConversationCenter()
  const {clearVersion, loaded, containsLatestMessage, messageOrdinals} = listData
  // Same reason as desktop: a centered load empties the thread before refilling it, and the list
  // needs to be told that is a new dataset rather than left waiting on layout for rows it already
  // threw away.
  const datasetKey = `${conversationIDKey}:${clearVersion}`
  const hasCentered = centeredOrdinal !== undefined

  const listRef = React.useRef<LegendListRef | null>(null)
  const markInitiallyLoadedThreadAsRead = useConversationThreadMarkThreadAsRead()

  const getItemType = useGetItemType()

  const insets = useSafeAreaInsets()

  // While the thread-search bar is open it overlays the bottom of the list. Reserve that height
  // as extra content padding (so the newest message clears it) and lift the jump-to-recent button
  // above both the keyboard and the bar. searchOverlayHeight is a reanimated SharedValue set by
  // the search bar's onLayout; mirror it to state for the (static) content padding.
  const searchOverlayHeight = React.useContext(ThreadSearchOverlayContext)
  const [searchPad, setSearchPad] = React.useState(0)
  useAnimatedReaction(
    () => searchOverlayHeight?.value ?? 0,
    (h, prev) => {
      if (h !== prev) {
        scheduleOnRN(setSearchPad, h)
      }
    },
    [searchOverlayHeight]
  )
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

  const {onStartReached, onEndReached} = usePagination({
    containsLatestMessage,
    messageOrdinals,
  })

  const {freeze, scrollMessageToEnd} = useKeyboardScrollToEnd({listRef})

  const {scrollToBottom} = useNativeScrolling({scrollMessageToEnd})

  const jumpToRecent = useJumpToRecent(scrollToBottom, messageOrdinals.length)

  useScrollToCentered({centeredOrdinal, datasetKey, listRef, messageOrdinals, ready: true})

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
  }, [conversationIDKey, loaded, markInitiallyLoadedThreadAsRead])

  const initialScrollIndex = useInitialScrollIndex(messageOrdinals, centeredOrdinal)

  // Reserve bottom space so the newest message clears the sticky input bar, which is pulled up
  // over the list bottom (KeyboardStickyView offset -insets.bottom) plus the floating typing
  // indicator. Without this the list scrolls to its content end but the newest row sits behind
  // the input bar.
  const listContentStyle = React.useMemo(
    () => ({paddingBottom: mobileTypingContainerHeight + insets.bottom + searchPad}),
    [insets.bottom, searchPad]
  )

  // The input bar (KeyboardStickyView, closed offset -insets.bottom) overlaps the bottom of the
  // list by insets.bottom, so without this the scroll indicator runs down behind it. Inset the
  // indicator by exactly that overlap (NOT the full content padding, which also reserves space for
  // the floating typing indicator that the scrollbar doesn't need to clear).
  const scrollIndicatorInsets = React.useMemo(() => ({bottom: insets.bottom}), [insets.bottom])

  return (
    <Kb.ErrorBoundary>
      <PerfProfiler id="MessageList">
        <Kb.Box2 direction="vertical" fullWidth={true} flex={1} relative={true}>
          <KeyboardAwareLegendList
            dataKey={datasetKey}
            testID={TestIDs.CHAT_MESSAGE_LIST}
            ref={listRef as never}
            data={messageOrdinals as T.Chat.Ordinal[]}
            renderItem={nativeRenderItem}
            keyExtractor={keyExtractor}
            getItemType={getItemType}
            ListHeaderComponent={SpecialTopMessage}
            ListFooterComponent={SpecialBottomMessage}
            // ~text-row average (measured); biased slightly up since underestimating makes a
            // bottom-anchored list scroll-to-end land short. Per-type averages take over after the
            // first render, so this only seeds frame one + far-offscreen items.
            estimatedItemSize={120}
            recycleItems={true}
            drawDistance={1000}
            // During fast flings LegendList emits a "light" signal; rows read it (useAdaptiveRender)
            // to drop their per-row swipe PanGestureHandler, cutting fling cost. Defaults: enter at
            // 4 px/ms, return to "normal" after settling.
            experimental_adaptiveRender={adaptiveRenderConfig}
            initialScrollAtEnd={initialScrollIndex === undefined}
            initialScrollIndex={initialScrollIndex}
            alignItemsAtEnd={true}
            overScrollMode="never"
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            maintainScrollAtEnd={!hasCentered}
            // Stays on while centered, like desktop: the centered load streams older messages in
            // above the target and rows above it swap estimatedItemSize for their measured height,
            // which slides the target out of view unless it stays anchored. Toggling this prop off
            // and back on also makes the list jump, so it is mounted with one config throughout.
            maintainVisibleContentPosition={mvcpData}
            onStartReached={onStartReached}
            onStartReachedThreshold={2}
            onEndReached={onEndReached}
            contentContainerStyle={listContentStyle}
            scrollIndicatorInsets={scrollIndicatorInsets}
            freeze={freeze}
            keyboardOffset={insets.bottom}
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

export default isMobile ? NativeConversationList : DesktopThreadWrapperWithProfiler
