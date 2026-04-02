import * as Chat from '@/stores/chat'
import type * as T from '@/constants/types'
import * as Hooks from './hooks'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import Separator from '../messages/separator'
import SpecialBottomMessage from '../messages/special-bottom-message'
import SpecialTopMessage from '../messages/special-top-message'
import {type LegendListRef} from '@legendapp/list/react-native'
import {KeyboardAvoidingLegendList} from '@legendapp/list/keyboard-test'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {mobileTypingContainerHeight} from '../input-area/normal/typing'
import {SetRecycleTypeContext} from '../recycle-type-context'
// import {useChatDebugDump} from '@/constants/chat/debug'
import {PerfProfiler} from '@/perf/react-profiler'
import {ScrollContext} from '../normal/context'
import noop from 'lodash/noop'
import {
  keyExtractor,
  useConversationListData,
  useMessageNodeRenderer,
  useOnStartReached,
  useRecycleType,
  useScrollToCentered,
  useTopOnScreen,
} from './list-shared'
// import {useDebugLayout} from '@/util/debug-react'

// We load the first thread automatically so in order to mark it read
// we send an action on the first mount once
let markedInitiallyLoaded = false

export const DEBUGDump = () => {}

const useScrolling = (p: {
  centeredOrdinal: T.Chat.Ordinal
  messageOrdinals: ReadonlyArray<T.Chat.Ordinal>
  listRef: React.RefObject<LegendListRef | null>
  ordinalIndexMap: ReadonlyMap<T.Chat.Ordinal, number>
}) => {
  const {centeredOrdinal, listRef, messageOrdinals, ordinalIndexMap} = p
  const numOrdinals = messageOrdinals.length
  const loadOlderMessages = Chat.useChatContext(s => s.dispatch.loadOlderMessagesDueToScroll)
  const [scrollToBottom] = React.useState(() => () => {
    void listRef.current?.scrollToEnd({animated: false})
  })

  const {setScrollRef} = React.useContext(ScrollContext)
  React.useEffect(() => {
    setScrollRef({scrollDown: noop, scrollToBottom, scrollUp: noop})
  }, [setScrollRef, scrollToBottom])

  const scrollToCentered = useScrollToCentered(listRef, centeredOrdinal, ordinalIndexMap)

  const onStartReached = () => {
    loadOlderMessages(numOrdinals)
  }

  return {
    onStartReached,
    scrollToBottom,
    scrollToCentered,
  }
}

const ConversationList = function ConversationList() {
  const {conversationIDKey, centeredHighlightOrdinal, centeredOrdinal, messageOrdinals, messageTypeMap, ordinalIndexMap} =
    useConversationListData()
  const data = messageOrdinals as Array<T.Chat.Ordinal>
  const lastOrdinal = messageOrdinals.at(-1)
  const separatorTrailingByLeading = React.useMemo(() => {
    const trailingByLeading = new Map<T.Chat.Ordinal, T.Chat.Ordinal>()
    for (let idx = 0; idx < messageOrdinals.length - 1; idx++) {
      const trailingItem = messageOrdinals[idx + 1]
      const leadingItem = messageOrdinals[idx]
      if (trailingItem !== undefined && leadingItem !== undefined) {
        trailingByLeading.set(leadingItem, trailingItem)
      }
    }
    return trailingByLeading
  }, [messageOrdinals])

  const {isTopOnScreen, onViewableItemsChanged} = useTopOnScreen(messageOrdinals)

  const insets = useSafeAreaInsets()
  const listRef = React.useRef<LegendListRef | null>(null)
  const {markInitiallyLoadedThreadAsRead} = Hooks.useActions({conversationIDKey})
  const renderMessageNode = useMessageNodeRenderer({centeredHighlightOrdinal, lastOrdinal, messageTypeMap})

  const renderItem = React.useCallback(
    ({item: ordinal}: {item: T.Chat.Ordinal}) => renderMessageNode(ordinal)?.node ?? null,
    [renderMessageNode]
  )

  const ItemSeparator = React.useCallback(
    ({leadingItem}: {leadingItem: T.Chat.Ordinal}) => {
      const trailingItem = separatorTrailingByLeading.get(leadingItem)
      if (!trailingItem) return null
      return <Separator leadingItem={trailingItem} trailingItem={leadingItem} />
    },
    [separatorTrailingByLeading]
  )

  const {getItemType, setRecycleType} = useRecycleType(messageOrdinals, messageTypeMap)

  const {
    scrollToCentered,
    scrollToBottom,
    onStartReached: onStartReachedBase,
  } = useScrolling({
    centeredOrdinal,
    listRef,
    messageOrdinals,
    ordinalIndexMap,
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

  const onStartReached = useOnStartReached({
    isTopOnScreen,
    numOrdinals: messageOrdinals.length,
    onStartReachedBase,
  })

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
