import * as C from '../../../constants'
import * as Container from '../../../util/container'
import * as Hooks from './hooks'
import * as Kb from '../../../common-adapters'
import * as React from 'react'
import * as Styles from '../../../styles'
import Separator from '../messages/separator'
import SpecialBottomMessage from '../messages/special-bottom-message'
import SpecialTopMessage from '../messages/special-top-message'
import type * as Types from '../../../constants/types/chat2'
import type {ItemType} from '.'
import {FlatList} from 'react-native'
import {ConvoIDContext, SeparatorMapContext} from '../messages/ids-context'
// import {FlashList, type ListRenderItemInfo} from '@shopify/flash-list'
import {getMessageRender} from '../messages/wrapper'
import {mobileTypingContainerHeight} from '../input-area/normal/typing'
import {SetRecycleTypeContext} from '../recycle-type-context'
import {ForceListRedrawContext} from '../force-list-redraw-context'
import {useChatDebugDump} from '../../../constants/chat2/debug'
import {usingFlashList} from './flashlist-config'

// TODO if we bring flashlist back bring back the patch
const List = /*usingFlashList ? FlashList :*/ FlatList

// We load the first thread automatically so in order to mark it read
// we send an action on the first mount once
let markedInitiallyLoaded = false

export const DEBUGDump = () => {}

// not highly documented. keeps new content from shifting around the list if you're scrolled up
const maintainVisibleContentPosition = {
  autoscrollToTopThreshold: 1,
  minIndexForVisible: 0,
}

const useScrolling = (p: {
  centeredOrdinal: Types.Ordinal
  messageOrdinals: Array<Types.Ordinal>
  cidChanged: boolean
  conversationIDKey: Types.ConversationIDKey
  listRef: React.MutableRefObject</*FlashList<ItemType> |*/ FlatList<ItemType> | null>
  requestScrollToBottomRef: React.MutableRefObject<(() => void) | undefined>
}) => {
  const {messageOrdinals, requestScrollToBottomRef} = p
  const {cidChanged, listRef, centeredOrdinal} = p
  const lastLoadOrdinal = React.useRef<Types.Ordinal>(-1)
  const oldestOrdinal = messageOrdinals[messageOrdinals.length - 1] ?? -1
  const loadOlderMessagesDueToScroll = C.useChatContext(s => s.dispatch.loadOlderMessagesDueToScroll)

  const loadOlderMessages = Container.useEvent(() => {
    // already loaded and nothing has changed
    if (lastLoadOrdinal.current === oldestOrdinal) {
      return
    }
    lastLoadOrdinal.current = oldestOrdinal
    loadOlderMessagesDueToScroll()
  })

  const scrollToBottom = React.useCallback(() => {
    listRef.current?.scrollToOffset({animated: false, offset: 0})
  }, [listRef])

  requestScrollToBottomRef.current = () => {
    scrollToBottom()
  }

  // only scroll to center once per
  const lastScrollToCentered = React.useRef(-1)
  if (cidChanged) {
    lastScrollToCentered.current = -1
  }

  const scrollToCentered = Container.useEvent(() => {
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
    loadOlderMessages()
  }, [loadOlderMessages])

  return {
    onEndReached,
    scrollToBottom,
    scrollToCentered,
  }
}

const emptyMap = new Map()

const ConversationList = React.memo(function ConversationList(p: {
  conversationIDKey: Types.ConversationIDKey
  requestScrollToBottomRef: React.MutableRefObject<(() => void) | undefined>
}) {
  const debugWhichList = __DEV__ ? (
    <Kb.Text type="HeaderBig" style={{backgroundColor: 'red', left: 0, position: 'absolute', top: 0}}>
      {usingFlashList ? 'FLASH' : 'old'}
    </Kb.Text>
  ) : null

  const {conversationIDKey, requestScrollToBottomRef} = p

  const [lastCID, setLastCID] = React.useState(conversationIDKey)
  const cidChanged = lastCID !== conversationIDKey
  if (cidChanged) {
    setLastCID(conversationIDKey)
  }

  // used to force a rerender when a type changes, aka placeholder resolves
  const [extraData, setExtraData] = React.useState(0)
  const [lastED, setLastED] = React.useState(extraData)

  const centeredOrdinal = C.useChatContext(s => s.messageCenterOrdinal)?.ordinal ?? -1
  const messageTypeMap = C.useChatContext(s => s.messageTypeMap)
  const _messageOrdinals = C.useChatContext(s => s.messageOrdinals)

  const messageOrdinals = React.useMemo(() => {
    return [...(_messageOrdinals ?? [])].reverse()
  }, [_messageOrdinals])

  // map to help the sep know the previous value
  const separatorMap = React.useMemo(() => {
    if (usingFlashList) return emptyMap
    const sm = new Map<Types.Ordinal, Types.Ordinal>()
    let p = 0
    for (const o of _messageOrdinals ?? []) {
      sm.set(o, p)
      p = o
    }
    return sm
  }, [_messageOrdinals])

  const listRef = React.useRef</*FlashList<ItemType> |*/ FlatList<ItemType> | null>(null)
  const {markInitiallyLoadedThreadAsRead} = Hooks.useActions({conversationIDKey})
  const keyExtractor = React.useCallback((ordinal: ItemType) => {
    return String(ordinal)
  }, [])

  const renderItem = React.useCallback(
    (info: /*ListRenderItemInfo<ItemType>*/ any) => {
      const index = info?.index ?? 0
      const ordinal = messageOrdinals[index]
      if (!ordinal) {
        return null
      }
      const type = messageTypeMap?.get(ordinal) ?? 'text'
      if (!type) return null
      const Clazz = getMessageRender(type)
      if (!Clazz) return null
      return <Clazz ordinal={ordinal} />
    },
    [messageOrdinals, messageTypeMap]
  )

  const recycleTypeRef = React.useRef(new Map<Types.Ordinal, string>())
  if (cidChanged || lastED !== extraData) {
    recycleTypeRef.current = new Map()
    setLastED(extraData)
  }
  const setRecycleType = React.useCallback((ordinal: Types.Ordinal, type: string) => {
    recycleTypeRef.current.set(ordinal, type)
  }, [])

  const numOrdinals = messageOrdinals.length

  const getItemType = Container.useEvent((ordinal: Types.Ordinal, idx: number) => {
    if (!ordinal) {
      return 'null'
    }
    if (numOrdinals - 1 === idx) {
      return 'sent'
    }
    return recycleTypeRef.current.get(ordinal) ?? messageTypeMap?.get(ordinal) ?? 'text'
  })

  const {scrollToCentered, scrollToBottom, onEndReached} = useScrolling({
    centeredOrdinal,
    cidChanged,
    conversationIDKey,
    listRef,
    messageOrdinals,
    requestScrollToBottomRef,
  })

  const jumpToRecent = Hooks.useJumpToRecent(conversationIDKey, scrollToBottom, messageOrdinals.length)

  Container.useDepChangeEffect(() => {
    centeredOrdinal && scrollToCentered()
  }, [centeredOrdinal, scrollToCentered])

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

  useChatDebugDump(
    'listArea',
    Container.useEvent(() => {
      if (!listRef.current) return ''
      const {props, state} = listRef.current as any
      const {extraData, data} = props

      // @ts-ignore
      const layoutManager = state?.layoutProvider?._lastLayoutManager ?? ({} as any)
      const {_layouts, _renderWindowSize, _totalHeight, _totalWidth} = layoutManager
      // @ts-ignore
      // const mm = window.DEBUGStore.store.getState().chat2.messageMap.get(conversationIDKey)
      // const reduxItems = messageOrdinals.map(o => ({o, type: mm.get(o)?.type}))

      console.log(listRef.current)

      const items = data?.map((ordinal: number, idx: number) => {
        const layout = _layouts?.[idx]
        // const m = mm.get(ordinal) ?? ({} as any)
        return {
          idx,
          layout,
          ordinal,
          // rid: m.id,
          // rtype: m.type,
        }
      })

      const details = {
        // children,
        _renderWindowSize,
        _totalHeight,
        _totalWidth,
        data,
        extraData,
        items,
      }
      return JSON.stringify(details)
    })
  )

  return (
    <Kb.ErrorBoundary>
      <ConvoIDContext.Provider value={conversationIDKey}>
        <SetRecycleTypeContext.Provider value={setRecycleType}>
          <ForceListRedrawContext.Provider value={forceListRedraw}>
            <SeparatorMapContext.Provider value={separatorMap}>
              <Kb.Box style={styles.container}>
                <List
                  extraData={extraData}
                  removeClippedSubviews={Styles.isAndroid}
                  // @ts-ignore
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
                  maintainVisibleContentPosition={maintainVisibleContentPosition}
                  onEndReached={onEndReached}
                  keyboardDismissMode="on-drag"
                  keyboardShouldPersistTaps="handled"
                  keyExtractor={keyExtractor}
                  ref={listRef}
                />
                {jumpToRecent}
                {debugWhichList}
              </Kb.Box>
            </SeparatorMapContext.Provider>
          </ForceListRedrawContext.Provider>
        </SetRecycleTypeContext.Provider>
      </ConvoIDContext.Provider>
    </Kb.ErrorBoundary>
  )
})

const styles = Styles.styleSheetCreate(
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
