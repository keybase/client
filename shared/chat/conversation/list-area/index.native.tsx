import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import * as T from '@/constants/types'
import * as Hooks from './hooks'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import Separator from '../messages/separator'
import SpecialBottomMessage from '../messages/special-bottom-message'
import SpecialTopMessage from '../messages/special-top-message'
import type {ItemType} from '.'
import {type LegendListRef} from '@legendapp/list/react-native'
import {KeyboardAvoidingLegendList} from '@legendapp/list/keyboard-test'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {getMessageRender} from '../messages/wrapper'
import {mobileTypingContainerHeight} from '../input-area/normal/typing'
import {SetRecycleTypeContext} from '../recycle-type-context'
// import {useChatDebugDump} from '@/constants/chat/debug'
import {PerfProfiler} from '@/perf/react-profiler'
import {ScrollContext} from '../normal/context'
import noop from 'lodash/noop'
// import {useDebugLayout} from '@/util/debug-react'

// We load the first thread automatically so in order to mark it read
// we send an action on the first mount once
let markedInitiallyLoaded = false

export const DEBUGDump = () => {}

// Stable empty array so we never create a new reference when ordinals are absent
const emptyOrdinals: Array<T.Chat.Ordinal> = []

const useScrolling = (p: {
  centeredOrdinal: T.Chat.Ordinal
  messageOrdinals: ReadonlyArray<T.Chat.Ordinal>
  conversationIDKey: T.Chat.ConversationIDKey
  listRef: React.RefObject<LegendListRef | null>
}) => {
  const {listRef, centeredOrdinal, messageOrdinals} = p
  const numOrdinals = messageOrdinals.length
  const loadOlderMessages = Chat.useChatContext(s => s.dispatch.loadOlderMessagesDueToScroll)
  const ordinalIndexMap = Chat.useChatContext(s => s.ordinalIndexMap)
  const [scrollToBottom] = React.useState(() => () => {
    void listRef.current?.scrollToEnd({animated: false})
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

  const ordinalIndexMapRef = React.useRef(ordinalIndexMap)
  React.useEffect(() => {
    ordinalIndexMapRef.current = ordinalIndexMap
  }, [ordinalIndexMap])

  const [scrollToCentered] = React.useState(() => () => {
    const list = listRef.current
    if (!list) {
      return
    }
    const co = centeredOrdinalRef.current
    if (lastScrollToCentered.current === co) {
      return
    }
    lastScrollToCentered.current = co

    const idx = ordinalIndexMapRef.current.get(co) ?? -1
    if (idx < 0) {
      return
    }
    // Scroll once, then re-scroll after the promise resolves so that size
    // stabilization has settled and the item lands in view correctly.
    void list.scrollToIndex({animated: false, index: idx, viewPosition: 0.5}).then(() => {
      void list.scrollToIndex({animated: false, index: idx, viewPosition: 0.5})
    })
  })

  const onStartReached = () => {
    loadOlderMessages(numOrdinals)
  }

  return {
    onStartReached,
    scrollToBottom,
    scrollToCentered,
  }
}

const keyExtractor = (ordinal: ItemType) => {
  return String(ordinal)
}

const ConversationList = function ConversationList() {
  const {conversationIDKey, centeredHighlightOrdinal, centeredOrdinal, messageTypeMap, _messageOrdinals} = Chat.useChatContext(
    C.useShallow(s => ({
      _messageOrdinals: s.messageOrdinals,
      centeredHighlightOrdinal:
        s.messageCenterOrdinal?.highlightMode !== 'none'
          ? (s.messageCenterOrdinal?.ordinal ?? T.Chat.numberToOrdinal(-1))
          : T.Chat.numberToOrdinal(-1),
      centeredOrdinal: s.messageCenterOrdinal?.ordinal ?? T.Chat.numberToOrdinal(-1),
      conversationIDKey: s.id,
      messageTypeMap: s.messageTypeMap,
    }))
  )

  const messageOrdinals = _messageOrdinals ?? emptyOrdinals
  const data = messageOrdinals as Array<T.Chat.Ordinal>
  const lastOrdinal = messageOrdinals.at(-1)
  const separatorTrailingByLeading = React.useMemo(() => {
    const trailingByLeading = new Map<T.Chat.Ordinal, T.Chat.Ordinal>()
    for (let idx = 0; idx < messageOrdinals.length - 1; idx++) {
      const trailingItem = messageOrdinals[idx + 1]
      const leadingItem = messageOrdinals[idx]
      if (trailingItem) {
        trailingByLeading.set(leadingItem, trailingItem)
      }
    }
    return trailingByLeading
  }, [messageOrdinals])

  // Always keep a ref to the latest messageOrdinals for use in stable callbacks.
  const messageOrdinalsRef = React.useRef(messageOrdinals)
  messageOrdinalsRef.current = messageOrdinals

  const [isTopOnScreen, setIsTopOnScreen] = React.useState(false)
  const onViewableItemsChanged = React.useCallback(
    ({viewableItems}: {viewableItems: Array<{item: T.Chat.Ordinal}>}) => {
      setIsTopOnScreen(viewableItems[0]?.item === messageOrdinalsRef.current[0])
    },
    []
  )

  const insets = useSafeAreaInsets()
  const listRef = React.useRef<LegendListRef | null>(null)
  const {markInitiallyLoadedThreadAsRead} = Hooks.useActions({conversationIDKey})

  const renderItem = React.useCallback(({item: ordinal}: {item: T.Chat.Ordinal}) => {
    const type = messageTypeMap.get(ordinal) ?? 'text'
    const Clazz = getMessageRender(type)
    if (!Clazz) return null
    return (
      <PerfProfiler id={`Msg-${type}`}>
        <Clazz
          isCenteredHighlight={centeredHighlightOrdinal === ordinal}
          isLastMessage={lastOrdinal === ordinal}
          ordinal={ordinal}
        />
      </PerfProfiler>
    )
  }, [centeredHighlightOrdinal, lastOrdinal, messageTypeMap])

  const ItemSeparator = React.useCallback(
    ({leadingItem}: {leadingItem: T.Chat.Ordinal}) => {
      const trailingItem = separatorTrailingByLeading.get(leadingItem)
      if (!trailingItem) return null
      return <Separator leadingItem={trailingItem} trailingItem={leadingItem} />
    },
    [separatorTrailingByLeading]
  )

  const recycleTypeRef = React.useRef(new Map<T.Chat.Ordinal, string>())
  const [setRecycleType] = React.useState(() => (ordinal: T.Chat.Ordinal, type: string) => {
    recycleTypeRef.current.set(ordinal, type)
  })

  const numOrdinals = messageOrdinals.length

  const getItemType = (ordinal: T.Chat.Ordinal, idx: number) => {
    if (!ordinal) {
      return 'null'
    }
    // Check recycleType first (set by messages after render — includes subtypes like 'text:reply')
    const recycled = recycleTypeRef.current.get(ordinal)
    if (recycled) return recycled
    const baseType = messageTypeMap.get(ordinal) ?? 'text'
    // Last item is most-recently sent; isolate it to avoid recycling with settled messages
    if (numOrdinals - 1 === idx && (baseType === 'text' || baseType === 'attachment')) {
      return `${baseType}:pending`
    }
    return baseType
  }

  const {
    scrollToCentered,
    scrollToBottom,
    onStartReached: onStartReachedBase,
  } = useScrolling({
    centeredOrdinal,
    conversationIDKey,
    listRef,
    messageOrdinals,
  })

  const jumpToRecent = Hooks.useJumpToRecent(scrollToBottom, messageOrdinals.length)

  const lastCenteredOrdinal = React.useRef(0)
  React.useEffect(() => {
    if (lastCenteredOrdinal.current === centeredOrdinal) {
      return
    }
    lastCenteredOrdinal.current = centeredOrdinal
    if (centeredOrdinal > 0) {
      scrollToCentered()
    }
  }, [centeredOrdinal, scrollToCentered])

  React.useEffect(() => {
    if (!markedInitiallyLoaded) {
      markedInitiallyLoaded = true
      markInitiallyLoadedThreadAsRead()
    }
  }, [markInitiallyLoadedThreadAsRead])

  const isLoadingOlderRef = React.useRef(false)
  const prevNumOrdinalsRef = React.useRef(numOrdinals)
  const loadResetTimerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const onStartReachedBaseRef = React.useRef(onStartReachedBase)

  React.useEffect(() => {
    onStartReachedBaseRef.current = onStartReachedBase
  }, [onStartReachedBase])

  React.useEffect(() => {
    if (numOrdinals !== prevNumOrdinalsRef.current) {
      prevNumOrdinalsRef.current = numOrdinals
      isLoadingOlderRef.current = false
      clearTimeout(loadResetTimerRef.current)
    }
  }, [numOrdinals])

  // Cleanup on unmount
  React.useEffect(() => () => clearTimeout(loadResetTimerRef.current), [])

  const [onStartReached] = React.useState(() => () => {
    if (isLoadingOlderRef.current) return
    isLoadingOlderRef.current = true
    clearTimeout(loadResetTimerRef.current)
    // Safety reset in case no messages arrive (already at top of history)
    loadResetTimerRef.current = setTimeout(() => {
      isLoadingOlderRef.current = false
    }, 3000)
    onStartReachedBaseRef.current()
  })

  // When the top item is actually visible, ensure we load — catches bad-scroll-position cases
  // where maintainVisibleContentPosition leaves us at the top without onStartReached firing.
  React.useEffect(() => {
    if (isTopOnScreen) {
      onStartReached()
    }
  }, [isTopOnScreen, onStartReached])

  return (
    <Kb.ErrorBoundary>
      <SetRecycleTypeContext value={setRecycleType}>
        <PerfProfiler id="MessageList">
          <KeyboardAvoidingLegendList
            testID="messageList"
            extraData={messageTypeMap}
            onViewableItemsChanged={onViewableItemsChanged}
            estimatedItemSize={80}
            ListHeaderComponent={<SpecialTopMessage isOnScreen={isTopOnScreen} />}
            ListFooterComponent={SpecialBottomMessage}
            overScrollMode="never"
            contentInset={{bottom: mobileTypingContainerHeight}}
            data={data}
            getItemType={getItemType}
            renderItem={renderItem}
            ItemSeparatorComponent={ItemSeparator}
            onStartReached={onStartReached}
            onStartReachedThreshold={0.3}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            keyExtractor={keyExtractor}
            ref={listRef}
            recycleItems={true}
            alignItemsAtEnd={true}
            initialScrollAtEnd={true}
            maintainScrollAtEnd={{animated: false}}
            maintainVisibleContentPosition={{data: true, size: true}}
            waitForInitialLayout={true}
            offset={insets.bottom}
          />
          {jumpToRecent}
        </PerfProfiler>
      </SetRecycleTypeContext>
    </Kb.ErrorBoundary>
  )
}

export default ConversationList
