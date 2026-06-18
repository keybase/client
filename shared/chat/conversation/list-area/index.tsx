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
import type {View} from 'react-native'
import {mobileTypingContainerHeight} from '../input-area/normal/typing'
import {
  KeyboardAwareLegendList,
  useKeyboardChatComposerInset,
  useKeyboardScrollToEnd,
} from '@legendapp/list/keyboard'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
type ItemType = T.Chat.Ordinal

const noOrdinals: ReadonlyArray<T.Chat.Ordinal> = []

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
  const data = useConversationThreadSelector(
    C.useShallow(s => ({
      containsLatestMessage: !s.moreToLoadForward,
      loaded: s.loaded,
      messageOrdinals: s.messageOrdinals ?? noOrdinals,
    }))
  )
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
  const loadNewerMessagesDueToScroll = useConversationThreadLoadNewerMessagesDueToScroll()
  const loadOlderMessagesDueToScroll = useConversationThreadLoadOlderMessagesDueToScroll()
  const getThreadLoadStatusOptions = useThreadLoadStatusOptionsGetter()

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

  const onStartReached = React.useCallback(() => {
    loadOlderMessagesDueToScroll(numOrdinalsRef.current, getThreadLoadStatusOptions())
  }, [loadOlderMessagesDueToScroll, getThreadLoadStatusOptions])

  // Load newer messages when scrolled to the end (only when not at latest)
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

  // When a centeredOrdinal is set at mount, start there; otherwise start at the end
  const _centeredIdx =
    centeredOrdinal !== undefined
      ? sortedIndexOf(messageOrdinals as unknown as number[], centeredOrdinal as unknown as number)
      : -1
  const initialScrollIndex = _centeredIdx >= 0 ? {index: _centeredIdx, viewPosition: 0.5 as const} : undefined

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
          keyExtractor={(ordinal: T.Chat.Ordinal) => String(ordinal)}
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

// LegendList's ItemSeparatorComponent supplies `leadingItem`; the mobile Separator keys
// off leadingItem (trailingItem is unused on mobile but required by its props).
const NativeSeparator = React.memo(({leadingItem}: {leadingItem: T.Chat.Ordinal}) => (
  <Separator leadingItem={leadingItem} trailingItem={leadingItem} />
))
NativeSeparator.displayName = 'NativeSeparator'

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
  const listData = useConversationThreadSelector(
    C.useShallow(s => ({
      containsLatestMessage: !s.moreToLoadForward,
      loaded: s.loaded,
      messageOrdinals: s.messageOrdinals ?? noOrdinals,
    }))
  )
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
  const loadOlderMessagesDueToScroll = useConversationThreadLoadOlderMessagesDueToScroll()
  const loadNewerMessagesDueToScroll = useConversationThreadLoadNewerMessagesDueToScroll()
  const getThreadLoadStatusOptions = useThreadLoadStatusOptionsGetter()

  const keyExtractor = (ordinal: ItemType) => {
    return String(ordinal)
  }

  const renderItem = React.useCallback(
    ({item: ordinal}: {item: T.Chat.Ordinal}) => (
      <MessageRow isCenteredHighlight={centeredHighlightOrdinalOrNone === ordinal} ordinal={ordinal} />
    ),
    [centeredHighlightOrdinalOrNone]
  )

  const numOrdinals = messageOrdinals.length

  const getItemType = useGetItemType()

  const insets = useSafeAreaInsets()

  // Stable refs read inside stable callbacks
  const numOrdinalsRef = React.useRef(numOrdinals)
  React.useEffect(() => {
    numOrdinalsRef.current = numOrdinals
  }, [numOrdinals])
  const containsLatestMessageRef = React.useRef(containsLatestMessage)
  React.useEffect(() => {
    containsLatestMessageRef.current = containsLatestMessage
  }, [containsLatestMessage])

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

  const jumpToRecent = useJumpToRecent(scrollToBottom, messageOrdinals.length)

  // top of the (non-inverted) list = oldest messages
  const onStartReached = React.useCallback(() => {
    loadOlderMessagesDueToScroll(numOrdinalsRef.current, getThreadLoadStatusOptions())
  }, [loadOlderMessagesDueToScroll, getThreadLoadStatusOptions])

  // end of the list = newest; only load newer when we are not already at the latest
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

  // When a centeredOrdinal is set at mount, start there; otherwise start at the end (newest).
  const centeredIdx = hasCentered
    ? sortedIndexOf(messageOrdinals as unknown as number[], centeredOrdinal as unknown as number)
    : -1
  const initialScrollIndex = centeredIdx >= 0 ? {index: centeredIdx, viewPosition: 0.5 as const} : undefined

  // Reserve bottom space so the newest message clears the sticky input bar, which is pulled up
  // over the list bottom (KeyboardStickyView offset -insets.bottom) plus the floating typing
  // indicator. Without this the list scrolls to its content end but the newest row sits behind
  // the input bar.
  const listContentStyle = React.useMemo(
    () => ({paddingBottom: mobileTypingContainerHeight + insets.bottom}),
    [insets.bottom]
  )

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
            ItemSeparatorComponent={NativeSeparator}
            estimatedItemSize={72}
            recycleItems={true}
            drawDistance={250}
            initialScrollAtEnd={initialScrollIndex === undefined}
            initialScrollIndex={initialScrollIndex}
            alignItemsAtEnd={true}
            overScrollMode="never"
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            maintainScrollAtEnd={!hasCentered}
            maintainVisibleContentPosition={hasCentered ? undefined : {data: true}}
            onStartReached={onStartReached}
            onStartReachedThreshold={2}
            onEndReached={onEndReached}
            contentContainerStyle={listContentStyle}
            contentInsetEndAdjustment={contentInsetEndAdjustment}
            freeze={freeze}
            keyboardOffset={insets.bottom}
          />
          ) : null}
          {jumpToRecent}
        </Kb.Box2>
      </PerfProfiler>
    </Kb.ErrorBoundary>
  )
}

export default isMobile ? NativeConversationList : DesktopThreadWrapperWithProfiler
