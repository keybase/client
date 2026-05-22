import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as Hooks from './hooks'
import * as React from 'react'
import type * as T from '@/constants/types'
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
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {KeyboardChatLegendList} from '@legendapp/list/keyboard-chat'
import {useSharedValue} from 'react-native-reanimated'

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
    clearTimeout(scrollStopTimerRef.current)
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
    if (centeredOrdinal !== undefined) {
      if (lastScrolledCenteredRef.current === centeredOrdinal) return
      const idx = sortedIndexOf(messageOrdinalsRef.current as unknown as number[], centeredOrdinal as unknown as number)
      if (idx < 0) return
      lastScrolledCenteredRef.current = centeredOrdinal
      const target = centeredOrdinal
      const doScrollToCenter = async () => {
        for (let attempt = 0; attempt < 4; attempt++) {
          const el = (
            wrapperRef.current as unknown as
              | {querySelector: (s: string) => {scrollIntoView: (o: object) => void} | null}
              | null
          )?.querySelector(`[data-ordinal="${target}"]`)
          if (el) {
            el.scrollIntoView({behavior: 'instant', block: 'center'})
            return
          }
          void listRef.current?.scrollToIndex({animated: false, index: idx, viewPosition: 0.5})
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
  const _centeredIdx = centeredOrdinal !== undefined
    ? sortedIndexOf(messageOrdinals as unknown as number[], centeredOrdinal as unknown as number)
    : -1
  const initialScrollIndex = _centeredIdx >= 0
    ? {index: _centeredIdx, viewPosition: 0.5 as const}
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
          maintainScrollAtEnd={centeredOrdinal !== undefined ? false : {on: {dataChange: true}}}
          maintainVisibleContentPosition={centeredOrdinal !== undefined ? undefined : {data: true}}
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

// Toggle to replace real rows with colored debug boxes.
const DEBUG_LEGEND = false
// Toggle extra logging (independent of debug boxes).
const DEBUG_LOG = false

const DEBUG_FIXED_HEIGHT = 72
const debugColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#F0A500', '#98D8C8'] as const
// XOR-fold so adjacent ordinals (which differ by ~1) land on different color buckets
const debugColor = (o: T.Chat.Ordinal) => {
  const n = Number(o)
  return debugColors[((n ^ (n >> 3) ^ (n >> 7)) & 0xff) % debugColors.length] ?? '#ccc'
}

const DebugTopHeader = () => (
  <Kb.Box2
    direction="horizontal"
    fullWidth={true}
    style={{alignItems: 'center', backgroundColor: '#222', height: 48, justifyContent: 'center'}}
  >
    <Kb.Text type="BodySmallSemibold" style={{color: '#fff'}}>── LIST HEADER ──</Kb.Text>
  </Kb.Box2>
)

const DebugRow = React.memo(({ordinal, index}: {ordinal: T.Chat.Ordinal; index: number}) => {
  const color = debugColor(ordinal)
  const isTop = index === 0
  return (
    <Kb.Box2
      direction="horizontal"
      fullWidth={true}
      style={{
        alignItems: 'center',
        backgroundColor: color,
        borderTopColor: isTop ? '#000' : 'transparent',
        borderTopWidth: isTop ? 3 : 0,
        height: DEBUG_FIXED_HEIGHT,
        justifyContent: 'center',
      }}
      onLayout={e => {
        const measured = e.nativeEvent.layout.height
        if (Math.abs(measured - DEBUG_FIXED_HEIGHT) > 0.5) {
          console.log(`[LegendDebug] DebugRow ordinal=${ordinal} expected=${DEBUG_FIXED_HEIGHT} measured=${measured}`)
        }
      }}
    >
      <Kb.Text type="BodySmall" style={{color: '#000'}}>{isTop ? `TOP: ${ordinal}` : String(ordinal)}</Kb.Text>
    </Kb.Box2>
  )
})
DebugRow.displayName = 'DebugRow'

const NativeMobileRow = React.memo(({ordinal}: {ordinal: T.Chat.Ordinal}) => {
  const {centeredHighlightOrdinal} = useConversationCenter()
  return (
    <>
      <Separator trailingItem={ordinal} />
      <MessageRow isCenteredHighlight={centeredHighlightOrdinal === ordinal} ordinal={ordinal} />
    </>
  )
})
NativeMobileRow.displayName = 'NativeMobileRow'

const NativeConversationList = function NativeConversationList() {
  const conversationIDKey = useConversationThreadID()
  const data = useConversationThreadSelector(
    C.useShallow(s => ({
      containsLatestMessage: !s.moreToLoadForward,
      loaded: s.loaded,
      messageOrdinals: s.messageOrdinals ?? noOrdinals,
    }))
  )
  const {centeredOrdinal} = useConversationCenter()
  const {containsLatestMessage, loaded, messageOrdinals} = data

  const listRef = React.useRef<React.ElementRef<typeof KeyboardChatLegendList> | null>(null)
  const {markInitiallyLoadedThreadAsRead} = Hooks.useActions()
  const loadOlderMessagesDueToScroll = useConversationThreadLoadOlderMessagesDueToScroll()
  const loadNewerMessagesDueToScroll = useConversationThreadLoadNewerMessagesDueToScroll()
  const getThreadLoadStatusOptions = useThreadLoadStatusOptionsGetter()
  const threadStore = useConversationThreadStore()
  const insets = useSafeAreaInsets()
  const contentInsetEndAdjustment = useSharedValue(insets.bottom)
  React.useEffect(() => {
    contentInsetEndAdjustment.value = insets.bottom
  }, [contentInsetEndAdjustment, insets.bottom])

  // Stable refs for values used inside stable callbacks
  const containsLatestMessageRef = React.useRef(containsLatestMessage)
  React.useEffect(() => {
    containsLatestMessageRef.current = containsLatestMessage
  }, [containsLatestMessage])

  const numOrdinalsRef = React.useRef(messageOrdinals.length)
  React.useEffect(() => {
    const prev = numOrdinalsRef.current
    const curr = messageOrdinals.length
    if (DEBUG_LOG && prev !== curr) {
      const scroll = listRef.current?.getState().scroll ?? 0
      const prevFirst = messageOrdinalsRef.current[0]
      const currFirst = messageOrdinals[0]
      const prependInfo = currFirst !== prevFirst ? ` firstOrd=${prevFirst}→${currFirst}` : ''
      console.log(`[LegendDebug] ordinals ${prev}→${curr} (+${curr - prev})${prependInfo}  scroll=${scroll.toFixed(1)}`)
    }
    numOrdinalsRef.current = messageOrdinals.length
  }, [messageOrdinals.length])

  const messageOrdinalsRef = React.useRef(messageOrdinals)
  React.useEffect(() => {
    messageOrdinalsRef.current = messageOrdinals
  }, [messageOrdinals])

  const getItemType = React.useCallback(
    (ordinal: T.Chat.Ordinal) => {
      const {messageMap, messageTypeMap} = threadStore.getState()
      const message = messageMap.get(ordinal)
      return message ? getMessageRowType(message, messageTypeMap.get(ordinal)) : (messageTypeMap.get(ordinal) ?? 'text')
    },
    [threadStore]
  )

  const scrollToBottom = React.useCallback(() => {
    void listRef.current?.scrollToEnd({animated: false})
  }, [])

  const {setScrollRef} = React.useContext(ScrollContext)
  React.useEffect(() => {
    setScrollRef({scrollDown: noop, scrollToBottom, scrollUp: noop})
  }, [setScrollRef, scrollToBottom])

  const onStartReached = C.useThrottledCallback(() => {
    if (DEBUG_LOG) {
      const scroll = listRef.current?.getState().scroll ?? 0
      console.log(`[LegendDebug] onStartReached  count=${numOrdinalsRef.current}  scroll=${scroll.toFixed(1)}`)
    }
    loadOlderMessagesDueToScroll(numOrdinalsRef.current, getThreadLoadStatusOptions())
  }, 200)

  React.useEffect(
    () => () => {
      onStartReached.cancel()
    },
    [onStartReached]
  )

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

  // Scroll to centered ordinal when it changes (search / thread navigation)
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
      void listRef.current?.scrollToIndex({animated: false, index: idx, viewPosition: 0.5})
    } else if (lastScrolledCenteredRef.current !== undefined) {
      lastScrolledCenteredRef.current = undefined
      if (containsLatestMessage) {
        void listRef.current?.scrollToEnd({animated: false})
      }
    }
  }, [centeredOrdinal, loaded, containsLatestMessage, messageOrdinals])

  // Mark thread as read after initial load (once per conversation)
  const markedReadRef = React.useRef(false)
  React.useLayoutEffect(() => {
    markedReadRef.current = false
  }, [conversationIDKey])

  React.useEffect(() => {
    if (!DEBUG_LOG) return
    const unsubs: Array<() => void> = []
    const t = setTimeout(() => {
      const state = listRef.current?.getState()
      if (!state) return
      unsubs.push(state.listen('totalSize', v => {
        const scroll = listRef.current?.getState().scroll ?? 0
        console.log(`[LegendDebug] totalSize=${v.toFixed(1)}  scroll=${scroll.toFixed(1)}`)
      }))
      unsubs.push(state.listen('scrollAdjust', v => {
        const scroll = listRef.current?.getState().scroll ?? 0
        console.log(`[LegendDebug] scrollAdjust=${(v ?? 0).toFixed(1)}  scroll=${scroll.toFixed(1)}`)
      }))
      unsubs.push(state.listen('scrollAdjustPending', v => {
        if (v) {
          const scroll = listRef.current?.getState().scroll ?? 0
          console.log(`[LegendDebug] scrollAdjustPending=${v.toFixed(1)}  scroll=${scroll.toFixed(1)}`)
        }
      }))
      console.log('[LegendDebug] state listeners attached')
    }, 300)
    return () => {
      clearTimeout(t)
      unsubs.forEach(fn => fn())
    }
  }, [])

  const onLoad = React.useCallback(() => {
    if (DEBUG_LOG) {
      const scroll = listRef.current?.getState().scroll ?? 0
      console.log(`[LegendDebug] onLoad  scroll=${scroll.toFixed(1)}`)
    }
    if (!markedReadRef.current) {
      markedReadRef.current = true
      markInitiallyLoadedThreadAsRead()
    }
  }, [markInitiallyLoadedThreadAsRead])

  const renderItem = React.useCallback(
    DEBUG_LEGEND
      ? ({item: ordinal, index}: {item: T.Chat.Ordinal; index: number}) => <DebugRow ordinal={ordinal} index={index} />
      : ({item: ordinal}: {item: T.Chat.Ordinal}) => <NativeMobileRow ordinal={ordinal} />,
    []
  )

  const jumpToRecent = Hooks.useJumpToRecent(scrollToBottom, messageOrdinals.length)

  const _centeredIdx =
    centeredOrdinal !== undefined
      ? sortedIndexOf(messageOrdinals as unknown as number[], centeredOrdinal as unknown as number)
      : -1
  const initialScrollIndex =
    _centeredIdx >= 0 ? {index: _centeredIdx, viewPosition: 0.5 as const} : undefined

  return (
    <Kb.ErrorBoundary>
      <PerfProfiler id="MessageList">
        <Kb.Box2 direction="vertical" fullWidth={true} flex={1} relative={true}>
          <KeyboardChatLegendList
              key={conversationIDKey}
              ref={listRef}
              data={messageOrdinals as unknown as T.Chat.Ordinal[]}
              renderItem={renderItem}
              keyExtractor={(ordinal: T.Chat.Ordinal) => String(ordinal)}
              getItemType={getItemType}
              ListHeaderComponent={DEBUG_LEGEND ? DebugTopHeader : SpecialTopMessage}
              ListFooterComponent={SpecialBottomMessage}
              recycleItems={false}
              drawDistance={250} // limits simultaneously-mounted items (analog to FlatList windowSize=3)
              estimatedItemSize={DEBUG_LEGEND ? DEBUG_FIXED_HEIGHT : 72}
              initialScrollAtEnd={initialScrollIndex === undefined}
              initialScrollIndex={initialScrollIndex}
              alignItemsAtEnd={true}
              maintainScrollAtEnd={centeredOrdinal !== undefined ? false : {on: {dataChange: true}}}
              maintainVisibleContentPosition={centeredOrdinal !== undefined ? undefined : {data: true, size: false}}
              onLoad={onLoad}
              onStartReached={onStartReached}
              onEndReached={onEndReached}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              contentInsetEndAdjustment={contentInsetEndAdjustment}
              offset={insets.bottom}
              testID="messageList"
          />
          {jumpToRecent}
        </Kb.Box2>
      </PerfProfiler>
    </Kb.ErrorBoundary>
  )
}

export default isMobile ? NativeConversationList : DesktopThreadWrapperWithProfiler
