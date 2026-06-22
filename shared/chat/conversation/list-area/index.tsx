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
import {getMessageRowType, getMessageShowUsername} from '../messages/row-metadata'
import {useCurrentUserState} from '@/stores/current-user'
import * as InputState from '../input-area/input-state'
import sortedIndexOf from 'lodash/sortedIndexOf'
import {copyToClipboard} from '@/util/storeless-actions'
import {FocusContext} from '../normal/context'
import noop from 'lodash/noop'
import {LegendList} from '@legendapp/list/react'
import type {LegendListRef} from '@/common-adapters'
import type {View} from 'react-native'
import {mobileTypingContainerHeight} from '../input-area/normal/typing'
import {
  KeyboardAwareLegendList,
  useKeyboardChatComposerInset,
  useKeyboardScrollToEnd,
} from '@legendapp/list/keyboard'
import {useReanimatedKeyboardAnimation} from 'react-native-keyboard-controller'
import Animated, {useAnimatedReaction, useAnimatedStyle} from 'react-native-reanimated'
import {scheduleOnRN} from 'react-native-worklets'
import {ThreadSearchOverlayContext} from '../thread-search-overlay-context'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
type ItemType = T.Chat.Ordinal

const noOrdinals: ReadonlyArray<T.Chat.Ordinal> = []

const keyExtractor = (ordinal: ItemType) => String(ordinal)

// trim off the search-bar lift so the jump button rests ~40px above the bar
const jumpAboveBarTrim = 40

// Item type for list recycling pool separation. A message that leads its author group renders an
// avatar + username header (~40px taller) than a grouped follow-on of the same render type. Without
// splitting the pool, recycleItems reuses one container across both heights, so a recycled view
// paints at the wrong height for a frame before re-measure — visible as rows overlapping during
// scroll. Append ':hdr' so header and grouped rows pool separately.
const useGetItemType = () => {
  const threadStore = useConversationThreadStore()
  const you = useCurrentUserState(s => s.username)
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
      const showUsername = getMessageShowUsername({
        message,
        messageMap,
        messageOrdinals: messageOrdinals ?? noOrdinals,
        ordinal,
        you,
      })
      return showUsername ? `${base}:hdr` : base
    },
    [threadStore, you]
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

const useNativeScrolling = (p: {
  centeredOrdinal: T.Chat.Ordinal
  listRef: React.RefObject<LegendListRef | null>
  scrollMessageToEnd: (o: {animated: boolean; closeKeyboard: boolean}) => Promise<void>
}) => {
  const {listRef, centeredOrdinal, scrollMessageToEnd} = p

  // scrollMessageToEnd freezes the keyboard-aware scroll view, scrolls to the end,
  // then unfreezes — so the newest message stays pinned above the input bar even
  // while the keyboard is open.
  const scrollToBottom = React.useCallback(() => {
    void scrollMessageToEnd({animated: false, closeKeyboard: false})
  }, [scrollMessageToEnd])

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
      void list.scrollToItem({animated: false, item: co, viewPosition: 0.5})
    }, 100)
  })

  return {
    scrollToBottom,
    scrollToCentered,
  }
}

const NativeConversationList = function NativeConversationList() {
  const conversationIDKey = useConversationThreadID()
  const listData = useThreadListData()
  const {centeredHighlightOrdinal, centeredOrdinal} = useConversationCenter()
  const noCenteredOrdinal = T.Chat.numberToOrdinal(-1)
  const centeredOrdinalOrNone = centeredOrdinal ?? noCenteredOrdinal
  const centeredHighlightOrdinalOrNone = centeredHighlightOrdinal ?? noCenteredOrdinal
  const {loaded, containsLatestMessage, messageOrdinals} = listData
  const hasCentered = centeredOrdinal !== undefined

  // initialScrollAtEnd only positions the FIRST render that has data. Coming from the inbox the
  // thread loads async after mount, so if the list mounted empty the initial scroll would run on
  // an empty list and never re-fire once data streamed in (cold-start has data at mount, which is
  // why only the inbox path was broken). Gate the list mount on loaded so its first render always
  // has data and initialScrollAtEnd lands at the newest message on both paths.
  const listReady = loaded || hasCentered

  const listRef = React.useRef<LegendListRef | null>(null)
  const markInitiallyLoadedThreadAsRead = useConversationThreadMarkThreadAsRead()

  const getItemType = useGetItemType()

  // Separator renders inline above each row (same as desktop) so the orange line keys off this
  // row's ordinal directly.
  const renderItem = React.useCallback(
    ({item: ordinal}: {item: T.Chat.Ordinal}) => (
      <>
        <Separator trailingItem={ordinal} />
        <MessageRow isCenteredHighlight={centeredHighlightOrdinalOrNone === ordinal} ordinal={ordinal} />
      </>
    ),
    [centeredHighlightOrdinalOrNone]
  )

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
  const {height: keyboardAnimHeight} = useReanimatedKeyboardAnimation()
  const insetsBottom = insets.bottom
  // The jump button sits in a sibling of the keyboard-aware list, so it does not move with the
  // keyboard on its own. Lift it past the keyboard (keyboard term) and past the search bar (bar
  // term) so it never hides behind either.
  const jumpLiftStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY:
          Math.min(keyboardAnimHeight.value + insetsBottom, 0) -
          Math.max((searchOverlayHeight?.value ?? 0) - jumpAboveBarTrim, 0),
      },
    ],
  }))

  const {onStartReached, onEndReached} = usePagination({containsLatestMessage, messageOrdinals})

  // The bottom clearance for the input bar is reserved statically via contentContainerStyle
  // (listContentStyle) below, so this composer inset is seeded to 0 — otherwise the two stack
  // and leave a large empty gap below the newest message on cold start. composerRef is null
  // (the composer lives in a sibling subtree, not this list) so measure() is never called.
  const composerRef = React.useRef<View | null>(null)
  const {contentInsetEndAdjustment} = useKeyboardChatComposerInset(listRef, composerRef, 0)
  const {freeze, scrollMessageToEnd} = useKeyboardScrollToEnd({listRef})

  const {scrollToCentered, scrollToBottom} = useNativeScrolling({
    centeredOrdinal: centeredOrdinalOrNone,
    listRef,
    scrollMessageToEnd,
  })

  // Latest centered target, read inside the stable re-assert callback.
  const centeredRef = React.useRef(centeredOrdinalOrNone)
  React.useEffect(() => {
    centeredRef.current = centeredOrdinalOrNone
  }, [centeredOrdinalOrNone])

  const jumpToRecent = useJumpToRecent(scrollToBottom, messageOrdinals.length)

  // Re-assert native centering on the current target. scrollToItem(viewPosition: 0.5) lands
  // accurately on its own, but the centered load streams older messages in afterward (pagination
  // prepends), so we re-call it across a few frames; maintainVisibleContentPosition keeps the row
  // steady between asserts.
  const [reassertCentered] = React.useState(() => () => {
    const co = centeredRef.current
    if (co <= 0) return
    void listRef.current?.scrollToItem({animated: false, item: co, viewPosition: 0.5})
  })

  // Center on the search hit once it actually appears in the loaded list. Centering on the raw
  // centeredOrdinal change is unreliable: navigating to a hit reloads the thread centered on it,
  // so messageOrdinals is briefly empty (the target not yet present) when the ordinal changes.
  // Wait for the target to load, then coarse-scroll and re-assert across the pagination settle.
  const lastCenteredOrdinal = React.useRef(0)
  React.useEffect(() => {
    if (centeredOrdinalOrNone <= 0) {
      lastCenteredOrdinal.current = 0
      return undefined
    }
    if (!messageOrdinals.includes(centeredOrdinalOrNone)) {
      return undefined
    }
    if (lastCenteredOrdinal.current === centeredOrdinalOrNone) {
      return undefined
    }
    lastCenteredOrdinal.current = centeredOrdinalOrNone
    scrollToCentered()
    const ids = [50, 250, 500, 900, 1400].map(d => setTimeout(reassertCentered, d))
    return () => {
      ids.forEach(clearTimeout)
    }
  }, [centeredOrdinalOrNone, messageOrdinals, scrollToCentered, reassertCentered])

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

    // Initial bottom position is handled declaratively by initialScrollAtEnd (the list is not
    // mounted until data is loaded, so its first render has data). Centered navigation still
    // needs an imperative nudge for the case where loaded flips true after centeredOrdinal set.
    if (centeredOrdinalOrNone > 0) {
      scrollToCentered()
      setTimeout(() => {
        scrollToCentered()
      }, 100)
    }
  }, [conversationIDKey, centeredOrdinalOrNone, loaded, markInitiallyLoadedThreadAsRead, scrollToCentered])

  const initialScrollIndex = useInitialScrollIndex(messageOrdinals, centeredOrdinal)

  // [LISTDBG] TEMP instrumentation. Two probes:
  //  1) one-shot settle dump per conversation (does the list land at the end / drift after?)
  //  2) a length-change dump that fires on EVERY messageOrdinals change after load, so late data
  //     (backfill pagination, appended joins/leaves, reactions changing the array) is captured —
  //     the one-shot dump alone misses everything that streams in after first load.
  // gap = contentLength - scroll - scrollLength = pixels below the viewport bottom (gap>0 = parked
  // above newest). dir = where the array changed: PREPEND (older/top) vs APPEND (newer/bottom).
  const dbgOrdsRef = React.useRef(messageOrdinals)
  dbgOrdsRef.current = messageOrdinals
  const dbgDump = React.useCallback(
    (tag: string) => {
      const s = listRef.current?.getState()
      const o = dbgOrdsRef.current
      // real measured per-type averages — use these to pick a representative estimatedItemSize
      let avgs = ''
      try {
        const a = s?.getAverageItemSizes?.() as Record<string, {average: number; count: number}> | undefined
        if (a) {
          avgs = Object.entries(a)
            .map(([k, v]) => `${k}:${Math.round(v.average)}(${v.count})`)
            .join(' ')
        }
      } catch {}
      console.log(
        `[LISTDBG] ${tag} conv=${conversationIDKey.slice(0, 6)} num=${o.length} ` +
          `first=${o[0]} last=${o[o.length - 1]} isAtEnd=${s?.isAtEnd} scroll=${Math.round(s?.scroll ?? -1)} ` +
          `scrollLength=${Math.round(s?.scrollLength ?? -1)} contentLength=${Math.round(s?.contentLength ?? -1)} ` +
          `gap=${Math.round((s?.contentLength ?? 0) - (s?.scroll ?? 0) - (s?.scrollLength ?? 0))} avgs=[${avgs}]`
      )
    },
    [conversationIDKey]
  )

  const dbgLoadedRef = React.useRef<string | undefined>(undefined)
  React.useEffect(() => {
    if (!loaded) return undefined
    if (dbgLoadedRef.current === conversationIDKey) return undefined
    dbgLoadedRef.current = conversationIDKey
    const ids = [0, 100, 300, 600, 1200, 2000, 3500].map(d => setTimeout(() => dbgDump(`t+${d}`), d))
    return () => {
      ids.forEach(clearTimeout)
    }
  }, [loaded, conversationIDKey, dbgDump])

  const dbgPrevRef = React.useRef<{conv: string; first?: T.Chat.Ordinal; last?: T.Chat.Ordinal; len: number}>({
    conv: '',
    len: -1,
  })
  React.useEffect(() => {
    if (!loaded) return undefined
    const o = messageOrdinals
    const p = dbgPrevRef.current
    const sameConv = p.conv === conversationIDKey
    const headChanged = p.first !== o[0]
    const tailChanged = p.last !== o[o.length - 1]
    const dir = !sameConv
      ? 'load'
      : `${headChanged ? 'PREPEND' : ''}${tailChanged ? 'APPEND' : ''}` ||
        (p.len !== o.length ? 'FILL' : 'same')
    dbgPrevRef.current = {conv: conversationIDKey, first: o[0], last: o[o.length - 1], len: o.length}
    if (sameConv && p.len === o.length && dir === 'same') return undefined
    const id = setTimeout(() => dbgDump(`change(${dir} ${p.len}->${o.length})`), 0)
    return () => clearTimeout(id)
  }, [loaded, conversationIDKey, messageOrdinals, dbgDump])

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
          {listReady ? (
          <KeyboardAwareLegendList
            key={conversationIDKey}
            testID={TestIDs.CHAT_MESSAGE_LIST}
            ref={listRef as never}
            data={messageOrdinals as T.Chat.Ordinal[]}
            renderItem={renderItem}
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
            initialScrollAtEnd={initialScrollIndex === undefined}
            initialScrollIndex={initialScrollIndex}
            alignItemsAtEnd={true}
            overScrollMode="never"
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            maintainScrollAtEnd={!hasCentered}
            // Default re-pin threshold is 0.1 (~10% of the viewport). Rows whose height settles
            // after first paint (flip result, audio/video, unfurls) can grow more than that near
            // the bottom and leave the thread parked above the newest message. Widen the window so
            // late growth still re-pins to the end.
            maintainScrollAtEndThreshold={0.5}
            maintainVisibleContentPosition={{data: true}}
            onStartReached={onStartReached}
            onStartReachedThreshold={2}
            onEndReached={onEndReached}
            contentContainerStyle={listContentStyle}
            scrollIndicatorInsets={scrollIndicatorInsets}
            contentInsetEndAdjustment={contentInsetEndAdjustment}
            freeze={freeze}
            keyboardOffset={insets.bottom}
          />
          ) : null}
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

export default isMobile ? NativeConversationList : DesktopThreadWrapperWithProfiler
