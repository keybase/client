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
import {LegendList, type LegendListRef} from '@legendapp/list/react-native'
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

// Sentinel ordinal for SpecialTopMessage rendered as a regular list item so
// LegendList can track its size changes and maintain scroll position correctly.
const SPECIAL_TOP_ORDINAL = T.Chat.numberToOrdinal(-2)

// LegendList passes leadingItem=older message, but Separator.tsx on mobile uses leadingItem
// as the ordinal for showUsernameMap, which is keyed by the newer (upper) message.
// Defined outside ConversationList so React sees a stable component type across renders.
const ItemSeparator = ({leadingItem}: {leadingItem: T.Chat.Ordinal}) => {
  const {ordinalIndexMap, messageOrdinals} = Chat.useChatContext(
    C.useShallow(s => ({messageOrdinals: s.messageOrdinals, ordinalIndexMap: s.ordinalIndexMap}))
  )
  // SpecialTopMessage renders its own separator at its bottom edge.
  if (leadingItem === SPECIAL_TOP_ORDINAL) return null
  const idx = ordinalIndexMap.get(leadingItem) ?? -1
  const trailingItem = messageOrdinals?.[idx + 1]
  if (!trailingItem) return null
  return <Separator leadingItem={trailingItem} trailingItem={leadingItem} />
}

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
  const {conversationIDKey, centeredOrdinal, messageTypeMap, _messageOrdinals} = Chat.useChatContext(
    C.useShallow(s => ({
      _messageOrdinals: s.messageOrdinals,
      centeredOrdinal: s.messageCenterOrdinal?.ordinal ?? T.Chat.numberToOrdinal(-1),
      conversationIDKey: s.id,
      messageTypeMap: s.messageTypeMap,
    }))
  )

  const messageOrdinals = _messageOrdinals ?? emptyOrdinals
  const data = React.useMemo(
    () => [SPECIAL_TOP_ORDINAL, ...(messageOrdinals as Array<T.Chat.Ordinal>)],
    [messageOrdinals]
  )

  const listRef = React.useRef<LegendListRef | null>(null)
  const {markInitiallyLoadedThreadAsRead} = Hooks.useActions({conversationIDKey})

  const renderItem = ({item: ordinal}: {item: T.Chat.Ordinal}) => {
    if (ordinal === SPECIAL_TOP_ORDINAL) {
      return <SpecialTopMessage />
    }
    const type = messageTypeMap.get(ordinal) ?? 'text'
    const Clazz = getMessageRender(type)
    if (!Clazz) return null
    return (
      <PerfProfiler id={`Msg-${type}`}>
        <Clazz ordinal={ordinal} />
      </PerfProfiler>
    )
  }

  const recycleTypeRef = React.useRef(new Map<T.Chat.Ordinal, string>())
  const setRecycleType = (ordinal: T.Chat.Ordinal, type: string) => {
    recycleTypeRef.current.set(ordinal, type)
  }

  const numOrdinals = messageOrdinals.length

  const getItemType = (ordinal: T.Chat.Ordinal, idx: number) => {
    if (ordinal === SPECIAL_TOP_ORDINAL) {
      return 'special-top'
    }
    if (!ordinal) {
      return 'null'
    }
    // Check recycleType first (set by messages after render — includes subtypes like 'text:reply')
    const recycled = recycleTypeRef.current.get(ordinal)
    if (recycled) return recycled
    const baseType = messageTypeMap.get(ordinal) ?? 'text'
    // Last item is most-recently sent; isolate it to avoid recycling with settled messages
    // +1 because SPECIAL_TOP_ORDINAL is at index 0, shifting all message indices by 1.
    if (numOrdinals === idx && (baseType === 'text' || baseType === 'attachment')) {
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

  const lastStartReachedRef = React.useRef(0)
  const onStartReached = () => {
    const t = Date.now()
    if (t - lastStartReachedRef.current < 1000) return
    lastStartReachedRef.current = t
    onStartReachedBase()
  }

  return (
    <Kb.ErrorBoundary>
      <SetRecycleTypeContext value={setRecycleType}>
        <PerfProfiler id="MessageList">
          <LegendList
            testID="messageList"
            extraData={messageTypeMap}
            estimatedItemSize={undefined}
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
            maintainVisibleContentPosition={true}
            waitForInitialLayout={true}
          />
          {jumpToRecent}
        </PerfProfiler>
      </SetRecycleTypeContext>
    </Kb.ErrorBoundary>
  )
}

export default ConversationList
