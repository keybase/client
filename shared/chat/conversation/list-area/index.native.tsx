import * as C from '@/constants'
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
import {getMessageRender} from '../messages/wrapper'
import {mobileTypingContainerHeight} from '../input-area/normal/typing'
import {SetRecycleTypeContext} from '../recycle-type-context'
import {ForceListRedrawContext} from '../force-list-redraw-context'
// import {useChatDebugDump} from '@/constants/chat2/debug'
import {usingFlashList} from './flashlist-config'
import {ScrollContext} from '../normal/context'
import noop from 'lodash/noop'
// import {useDebugLayout} from '@/util/debug-react'

// TODO if we bring flashlist back bring back the patch
const List = /*usingFlashList ? FlashList :*/ FlatList

// We load the first thread automatically so in order to mark it read
// we send an action on the first mount once
let markedInitiallyLoaded = false

export const DEBUGDump = () => {}

const useScrolling = (p: {
  centeredOrdinal: T.Chat.Ordinal
  messageOrdinals: Array<T.Chat.Ordinal>
  cidChanged: boolean
  conversationIDKey: T.Chat.ConversationIDKey
  listRef: React.MutableRefObject</*FlashList<ItemType> |*/ FlatList<ItemType> | null>
}) => {
  const {cidChanged, listRef, centeredOrdinal, messageOrdinals} = p
  const numOrdinals = messageOrdinals.length
  const loadOlderMessages = C.useChatContext(s => s.dispatch.loadOlderMessagesDueToScroll)
  const scrollToBottom = React.useCallback(() => {
    listRef.current?.scrollToOffset({animated: false, offset: 0})
  }, [listRef])

  const {scrollRef} = React.useContext(ScrollContext)
  scrollRef.current = {scrollDown: noop, scrollToBottom, scrollUp: noop}

  // only scroll to center once per
  const lastScrollToCentered = React.useRef(-1)
  if (cidChanged) {
    lastScrollToCentered.current = T.Chat.numberToOrdinal(-1)
  }

  const scrollToCentered = C.useEvent(() => {
    setTimeout(() => {
      const list = listRef.current
      if (!list) {
        return
      }
      if (lastScrollToCentered.current === centeredOrdinal) {
        return
      }

      lastScrollToCentered.current = centeredOrdinal
      list.scrollToItem({animated: false, item: centeredOrdinal, viewPosition: 0.5})
    }, 100)
  })

  const onEndReached = React.useCallback(() => {
    loadOlderMessages(numOrdinals)
  }, [loadOlderMessages, numOrdinals])

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
const ConversationList = React.memo(function ConversationList() {
  const debugWhichList = __DEV__ ? (
    <Kb.Text type="HeaderBig" style={{backgroundColor: 'red', left: 0, position: 'absolute', top: 0}}>
      {usingFlashList ? 'FLASH' : 'old'}
    </Kb.Text>
  ) : null

  const conversationIDKey = C.useChatContext(s => s.id)
  const cidChanged = C.Chat.useCIDChanged(conversationIDKey)

  // used to force a rerender when a type changes, aka placeholder resolves
  const [extraData, setExtraData] = React.useState(0)
  const [lastED, setLastED] = React.useState(extraData)

  const centeredOrdinal = C.useChatContext(s => s.messageCenterOrdinal)?.ordinal ?? T.Chat.numberToOrdinal(-1)
  const messageTypeMap = C.useChatContext(s => s.messageTypeMap)
  const _messageOrdinals = C.useChatContext(s => s.messageOrdinals)

  const messageOrdinals = React.useMemo(() => {
    return [...(_messageOrdinals ?? [])].reverse()
  }, [_messageOrdinals])

  const listRef = React.useRef</*FlashList<ItemType> |*/ FlatList<ItemType> | null>(null)
  const {markInitiallyLoadedThreadAsRead} = Hooks.useActions({conversationIDKey})
  const keyExtractor = React.useCallback((ordinal: ItemType) => {
    return String(ordinal)
  }, [])

  const renderItem = React.useCallback(
    (info?: /*ListRenderItemInfo<ItemType>*/ {index?: number}) => {
      const index: number = info?.index ?? 0
      const ordinal = messageOrdinals[index]
      if (!ordinal) {
        return null
      }
      const type = messageTypeMap.get(ordinal) ?? 'text'
      const Clazz = getMessageRender(type)
      if (!Clazz) return null
      return <Clazz ordinal={ordinal} />
    },
    [messageOrdinals, messageTypeMap]
  )

  const recycleTypeRef = React.useRef(new Map<T.Chat.Ordinal, string>())
  if (cidChanged || lastED !== extraData) {
    recycleTypeRef.current = new Map()
    setLastED(extraData)
  }
  const setRecycleType = React.useCallback((ordinal: T.Chat.Ordinal, type: string) => {
    recycleTypeRef.current.set(ordinal, type)
  }, [])

  const numOrdinals = messageOrdinals.length

  const getItemType = C.useEvent((ordinal: T.Chat.Ordinal, idx: number) => {
    if (!ordinal) {
      return 'null'
    }
    if (numOrdinals - 1 === idx) {
      return 'sent'
    }
    return recycleTypeRef.current.get(ordinal) ?? messageTypeMap.get(ordinal) ?? 'text'
  })

  const {scrollToCentered, scrollToBottom, onEndReached} = useScrolling({
    centeredOrdinal,
    cidChanged,
    conversationIDKey,
    listRef,
    messageOrdinals,
  })

  const jumpToRecent = Hooks.useJumpToRecent(scrollToBottom, messageOrdinals.length)

  const lastCenteredOrdinal = React.useRef(0)
  if (lastCenteredOrdinal.current !== centeredOrdinal) {
    lastCenteredOrdinal.current = centeredOrdinal
    if (centeredOrdinal) {
      // let it render first
      setTimeout(() => {
        scrollToCentered()
      }, 16)
    }
  }

  if (!markedInitiallyLoaded) {
    markedInitiallyLoaded = true
    markInitiallyLoadedThreadAsRead()
  }

  // We use context to inject a way for items to force the list to rerender when they notice something about their
  // internals have changed (aka a placeholder isn't a placeholder anymore). This can be racy as if you detect this
  // and call you can get effectively memoized. In order to allow the item to re-render if they're still in this state
  // we make this callback mutate, so they have a chance to rerender and recall it
  // A repro is a placeholder resolving as a placeholder multiple times before resolving for real
  const forceListRedraw = React.useCallback(() => {
    extraData // just to silence eslint
    // wrap in timeout so we don't get max update depths sometimes
    setTimeout(() => {
      setExtraData(d => d + 1)
    }, 100)
  }, [extraData])

  // useChatDebugDump(
  //   'listArea',
  //   C.useEvent(() => {
  //     if (!listRef.current) return ''
  //     const {props, state} = listRef.current as {
  //       props: {extraData?: {}; data?: [number]}
  //       state?: object
  //     }
  //     const {extraData, data} = props
  //
  //     // const layoutManager = (state?.layoutProvider?._lastLayoutManager ?? ({} as unknown)) as {
  //     //   _layouts?: [unknown]
  //     //   _renderWindowSize: unknown
  //     //   _totalHeight: unknown
  //     //   _totalWidth: unknown
  //     // }
  //     // const {_layouts, _renderWindowSize, _totalHeight, _totalWidth} = layoutManager
  //     // const mm = window.DEBUGStore.store.getState().chat2.messageMap.get(conversationIDKey)
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
  //       extraData,
  //       items,
  //     }
  //     return JSON.stringify(details)
  //   })
  // )

  const onViewableItemsChanged = useSafeOnViewableItemsChanged(onEndReached, messageOrdinals.length)
  // const onLayout = useDebugLayout()

  return (
    <Kb.ErrorBoundary>
      <SetRecycleTypeContext.Provider value={setRecycleType}>
        <ForceListRedrawContext.Provider value={forceListRedraw}>
          <Kb.Box style={styles.container}>
            <List
              onScrollToIndexFailed={noop}
              extraData={extraData}
              removeClippedSubviews={Kb.Styles.isAndroid}
              // @ts-ignore part of FlashList so lets set it
              drawDistance={100}
              estimatedItemSize={100}
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
              // onlayout={onLayout}
            />
            {jumpToRecent}
            {debugWhichList}
          </Kb.Box>
        </ForceListRedrawContext.Provider>
      </SetRecycleTypeContext.Provider>
    </Kb.ErrorBoundary>
  )
})

const minTimeDelta = 1000
const minDistanceFromEnd = 10

const useSafeOnViewableItemsChanged = (onEndReached: () => void, numOrdinals: number) => {
  const nextCallbackRef = React.useRef(new Date().getTime())
  const onEndReachedRef = React.useRef(onEndReached)
  onEndReachedRef.current = onEndReached
  const numOrdinalsRef = React.useRef(numOrdinals)
  numOrdinalsRef.current = numOrdinals

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
      container: {flex: 1, position: 'relative'},
      contentContainer: {
        paddingBottom: 0,
        paddingTop: mobileTypingContainerHeight,
      },
    }) as const
)

export default ConversationList
