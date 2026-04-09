import * as Chat from '@/stores/chat'
import * as T from '@/constants/types'
import * as Hooks from './hooks'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import Separator from '../messages/separator'
import SpecialBottomMessage from '../messages/special-bottom-message'
import SpecialTopMessage from '../messages/special-top-message'
import type {ItemType} from '.'
import {FlatList} from 'react-native'
// import {FlashList, type ListRenderItemInfo} from '@shopify/flash-list'
import {MessageRow} from '../messages/wrapper'
import {mobileTypingContainerHeight} from '../input-area/normal/typing'
// import {useChatDebugDump} from '@/constants/chat/debug'
import {usingFlashList} from './flashlist-config'
import {PerfProfiler} from '@/perf/react-profiler'
import {ScrollContext} from '../normal/context'
import noop from 'lodash/noop'
// import {useDebugLayout} from '@/util/debug-react'

// TODO if we bring flashlist back bring back the patch
const List = /*usingFlashList ? FlashList :*/ FlatList
const noOrdinals: ReadonlyArray<T.Chat.Ordinal> = []

// We load the first thread automatically so in order to mark it read
// we send an action on the first mount once
let markedInitiallyLoaded = false

export const DEBUGDump = () => {}

const useInvertedMessageOrdinals = (messageOrdinals?: ReadonlyArray<T.Chat.Ordinal>) => {
  const cacheRef = React.useRef<{
    inverted: ReadonlyArray<T.Chat.Ordinal>
    source: ReadonlyArray<T.Chat.Ordinal>
  }>({inverted: noOrdinals, source: noOrdinals})
  const source = messageOrdinals ?? noOrdinals
  if (cacheRef.current.source !== source) {
    cacheRef.current = {
      inverted: source.length > 1 ? [...source].reverse() : source,
      source,
    }
  }
  return cacheRef.current.inverted
}

const useScrolling = (p: {
  centeredOrdinal: T.Chat.Ordinal
  messageOrdinals: ReadonlyArray<T.Chat.Ordinal>
  conversationIDKey: T.Chat.ConversationIDKey
  listRef: React.RefObject</*FlashList<ItemType> |*/ FlatList<ItemType> | null>
}) => {
  const {listRef, centeredOrdinal, messageOrdinals} = p
  const numOrdinals = messageOrdinals.length
  const loadOlderMessages = Chat.useChatContext(s => s.dispatch.loadOlderMessagesDueToScroll)
  const [scrollToBottom] = React.useState(() => () => {
    listRef.current?.scrollToOffset({animated: false, offset: 0})
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
      list.scrollToItem({animated: false, item: co, viewPosition: 0.5})
    }, 100)
  })

  const onEndReached = () => {
    loadOlderMessages(numOrdinals)
  }

  return {
    onEndReached,
    scrollToBottom,
    scrollToCentered,
  }
}

// This keeps the list stable when data changes. If we don't do this it will jump around
// when new messages come in and its very easy to get this to cause an unstoppable loop of
// quick janking up and down
const maintainVisibleContentPosition = {autoscrollToTopThreshold: 1, minIndexForVisible: 0}
const ConversationList = function ConversationList() {
  const debugWhichList = __DEV__ ? (
    <Kb.Text type="HeaderBig" style={{backgroundColor: 'red', left: 0, position: 'absolute', top: 0}}>
      {usingFlashList ? 'FLASH' : 'old'}
    </Kb.Text>
  ) : null

  const conversationIDKey = Chat.useChatContext(s => s.id)

  const loaded = Chat.useChatContext(s => s.loaded)
  const messageCenterOrdinal = Chat.useChatContext(s => s.messageCenterOrdinal)
  const centeredHighlightOrdinal =
    messageCenterOrdinal && messageCenterOrdinal.highlightMode !== 'none'
      ? messageCenterOrdinal.ordinal
      : T.Chat.numberToOrdinal(-1)
  const centeredOrdinal = messageCenterOrdinal?.ordinal ?? T.Chat.numberToOrdinal(-1)
  const messageTypeMap = Chat.useChatContext(s => s.messageTypeMap)
  const _messageOrdinals = Chat.useChatContext(s => s.messageOrdinals)
  const rowRecycleTypeMap = Chat.useChatContext(s => s.rowRecycleTypeMap)

  const messageOrdinals = useInvertedMessageOrdinals(_messageOrdinals)

  const listRef = React.useRef</*FlashList<ItemType> |*/ FlatList<ItemType> | null>(null)
  const {markInitiallyLoadedThreadAsRead} = Hooks.useActions({conversationIDKey})
  const keyExtractor = (ordinal: ItemType) => {
    return String(ordinal)
  }

  const renderItem = (info?: /*ListRenderItemInfo<ItemType>*/ {item?: ItemType}) => {
    const ordinal = info?.item
    if (!ordinal) {
      return null
    }
    return (
      <MessageRow
        isCenteredHighlight={centeredHighlightOrdinal === ordinal}
        ordinal={ordinal}
      />
    )
  }

  const numOrdinals = messageOrdinals.length

  const getItemType = (ordinal: T.Chat.Ordinal) => {
    if (!ordinal) {
      return 'null'
    }
    const recycled = rowRecycleTypeMap.get(ordinal)
    if (recycled) return recycled
    return messageTypeMap.get(ordinal) ?? 'text'
  }

  const {scrollToCentered, scrollToBottom, onEndReached} = useScrolling({
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
      const id = setTimeout(() => {
        scrollToCentered()
      }, 200)
      return () => {
        clearTimeout(id)
      }
    }
    return undefined
  }, [centeredOrdinal, scrollToCentered])

  React.useEffect(() => {
    if (!markedInitiallyLoaded) {
      markedInitiallyLoaded = true
      markInitiallyLoadedThreadAsRead()
    }
  }, [markInitiallyLoadedThreadAsRead])

  const prevLoadedRef = React.useRef(loaded)
  React.useLayoutEffect(() => {
    const justLoaded = loaded && !prevLoadedRef.current
    prevLoadedRef.current = loaded

    if (!justLoaded) return

    if (centeredOrdinal > 0) {
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
  }, [loaded, centeredOrdinal, scrollToBottom, scrollToCentered, numOrdinals])

  // useChatDebugDump(
  //   'listArea',
  //   C.useEvent(() => {
  //     if (!listRef.current) return ''
  //     const {props, state} = listRef.current as {
  //       props: {data?: [number]}
  //       state?: object
  //     }
  //     const {data} = props
  //
  //     // const layoutManager = (state?.layoutProvider?._lastLayoutManager ?? ({} as unknown)) as {
  //     //   _layouts?: [unknown]
  //     //   _renderWindowSize: unknown
  //     //   _totalHeight: unknown
  //     //   _totalWidth: unknown
  //     // }
  //     // const {_layouts, _renderWindowSize, _totalHeight, _totalWidth} = layoutManager
  //     // const mm = window.DEBUGStore.store.getState().chat.messageMap.get(conversationIDKey)
  //     // const stateItems = messageOrdinals.map(o => ({o, type: mm.get(o)?.type}))
  //
  //     console.log(listRef.current)
  //
  //     const items = data?.map((ordinal: number, idx: number) => {
  //       const layout = _layouts?.[idx]
  //       // const m = mm.get(ordinal) ?? ({} as any)
  //       return {
  //         idx,
  //         layout,
  //         ordinal,
  //         // rid: m.id,
  //         // rtype: m.type,
  //       }
  //     })
  //
  //     const details = {
  //       // children,
  //       _renderWindowSize,
  //       _totalHeight,
  //       _totalWidth,
  //       data,
  //       items,
  //     }
  //     return JSON.stringify(details)
  //   })
  // )

  const onViewableItemsChanged = useSafeOnViewableItemsChanged(onEndReached, messageOrdinals.length)
  // const onLayout = useDebugLayout()

  return (
    <Kb.ErrorBoundary>
      <PerfProfiler id="MessageList">
        <Kb.Box2 direction="vertical" fullWidth={true} flex={1} relative={true}>
          <List
            testID="messageList"
            onScrollToIndexFailed={noop}
            // @ts-ignore LegendList/FlashList prop; ignored by FlatList
            estimatedItemSize={72}
            ListHeaderComponent={SpecialBottomMessage}
            ListFooterComponent={SpecialTopMessage}
            ItemSeparatorComponent={Separator}
            overScrollMode="never"
            contentContainerStyle={styles.contentContainer}
            data={messageOrdinals}
            getItemType={getItemType}
            inverted={true}
            renderItem={renderItem}
            onViewableItemsChanged={onViewableItemsChanged.current}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            keyExtractor={keyExtractor}
            ref={listRef}
            maintainVisibleContentPosition={
              // MUST do this else if you come into a new thread it'll slowly scroll down when it loads
              numOrdinals ? maintainVisibleContentPosition : undefined
            }
          />
          {jumpToRecent}
          {debugWhichList}
        </Kb.Box2>
      </PerfProfiler>
    </Kb.ErrorBoundary>
  )
}

const minTimeDelta = 1000
const minDistanceFromEnd = 10

const useSafeOnViewableItemsChanged = (onEndReached: () => void, numOrdinals: number) => {
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

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      contentContainer: {
        paddingBottom: 0,
        paddingTop: mobileTypingContainerHeight,
      },
    }) as const
)

export default ConversationList
