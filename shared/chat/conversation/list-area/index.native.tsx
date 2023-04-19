import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Constants from '../../../constants/chat2'
import * as Container from '../../../util/container'
import * as Hooks from './hooks'
import * as Kb from '../../../common-adapters/mobile.native'
import * as React from 'react'
import * as Styles from '../../../styles'
import Separator from '../messages/separator'
import SpecialBottomMessage from '../messages/special-bottom-message'
import SpecialTopMessage from '../messages/special-top-message'
import type * as Types from '../../../constants/types/chat2'
import type {ItemType} from '.'
import {Animated, FlatList} from 'react-native'
import {ConvoIDContext, SeparatorMapContext} from '../messages/ids-context'
import {FlashList, type ListRenderItemInfo} from '@shopify/flash-list'
import {getMessageRender} from '../messages/wrapper'
import {mobileTypingContainerHeight} from '../input-area/normal/typing'
import {SetRecycleTypeContext} from '../recycle-type-context'
import {ForceListRedrawContext} from '../force-list-redraw-context'
import shallowEqual from 'shallowequal'
import {useChatDebugDump} from '../../../constants/chat2/debug'
import {usingFlashList} from './flashlist-config'

const List = usingFlashList ? FlashList : FlatList

// Bookkeep whats animating so it finishes and isn't replaced, if we've animated it we keep the key and use null
const animatingMap = new Map<string, null | React.ReactElement>()

type AnimatedChildProps = {
  animatingKey: string
  children: React.ReactNode
}
const AnimatedChild = React.memo(function AnimatedChild({children, animatingKey}: AnimatedChildProps) {
  const translateY = new Animated.Value(999)
  const opacity = new Animated.Value(0)
  React.useEffect(() => {
    // on unmount, mark it null
    return () => {
      animatingMap.set(animatingKey, null)
    }
  }, [animatingKey])

  // only animate up once
  const onceRef = React.useRef(false)

  React.useEffect(() => {
    onceRef.current = false
  }, [animatingKey])

  return (
    <Animated.View
      style={{opacity, overflow: 'hidden', transform: [{translateY}], width: '100%'}}
      onLayout={(e: any) => {
        const {height} = e.nativeEvent.layout
        if (onceRef.current) {
          return
        }
        onceRef.current = true
        translateY.setValue(height + 10)
        Animated.parallel([
          Animated.timing(opacity, {
            duration: 200,
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            duration: 200,
            toValue: 0,
            useNativeDriver: true,
          }),
        ]).start(() => {
          animatingMap.set(animatingKey, null)
        })
      }}
    >
      {children}
    </Animated.View>
  )
})

type SentProps = {
  children?: React.ReactElement
  ordinal: Types.Ordinal
}
const Sent = React.memo(function Sent({ordinal}: SentProps) {
  const conversationIDKey = React.useContext(ConvoIDContext)
  const {subType, youSent} = Container.useSelector(state => {
    const you = state.config.username
    const message = state.chat2.messageMap.get(conversationIDKey)?.get(ordinal)
    const youSent = message && message.author === you && message.ordinal !== message.id
    const subType = message ? Constants.getMessageRenderType(message) : undefined
    return {subType, youSent}
  }, shallowEqual)
  const key = `${conversationIDKey}:${ordinal}`
  const state = animatingMap.get(key)

  if (!subType) return null

  // if its animating always show it
  if (state) {
    return state
  }

  const Clazz = getMessageRender(subType)
  if (!Clazz) return null
  const children = <Clazz ordinal={ordinal} />
  // if state is null we already animated it
  if (youSent && state === undefined) {
    const c = <AnimatedChild animatingKey={key}>{children}</AnimatedChild>
    animatingMap.set(key, c)
    return c
  } else {
    return children || null
  }
})

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
  conversationIDKey: Types.ConversationIDKey
  listRef: React.MutableRefObject<FlashList<ItemType> | FlatList<ItemType> | null>
  requestScrollToBottomRef: React.MutableRefObject<(() => void) | undefined>
}) => {
  const {listRef, centeredOrdinal, messageOrdinals, conversationIDKey, requestScrollToBottomRef} = p
  const dispatch = Container.useDispatch()
  const lastLoadOrdinal = React.useRef<Types.Ordinal>(-1)
  const oldestOrdinal = messageOrdinals[messageOrdinals.length - 1] ?? -1
  const loadOlderMessages = Container.useEvent(() => {
    // already loaded and nothing has changed
    if (lastLoadOrdinal.current === oldestOrdinal) {
      return
    }
    lastLoadOrdinal.current = oldestOrdinal
    dispatch(Chat2Gen.createLoadOlderMessagesDueToScroll({conversationIDKey}))
  })

  const scrollToBottom = React.useCallback(() => {
    listRef.current?.scrollToOffset({animated: false, offset: 0})
  }, [listRef])

  requestScrollToBottomRef.current = () => {
    scrollToBottom()
  }

  // only scroll to center once per
  const lastScrollToCentered = React.useRef(-1)
  React.useEffect(() => {
    lastScrollToCentered.current = -1
  }, [conversationIDKey])

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

  // used to force a rerender when a type changes, aka placeholder resolves
  const [extraData, setExtraData] = React.useState(0)

  const {conversationIDKey, requestScrollToBottomRef} = p
  const {centeredOrdinal, _messageOrdinals, messageTypeMap} = Container.useSelector(state => {
    const centeredOrdinal = Constants.getMessageCenterOrdinal(state, conversationIDKey)?.ordinal ?? -1
    const _messageOrdinals = Constants.getMessageOrdinals(state, conversationIDKey)
    const messageTypeMap = state.chat2.messageTypeMap.get(conversationIDKey)
    return {_messageOrdinals, centeredOrdinal, messageTypeMap}
  }, shallowEqual)

  const messageOrdinals = React.useMemo(() => {
    return [..._messageOrdinals].reverse()
  }, [_messageOrdinals])

  // map to help the sep know the previous value
  const separatorMap = React.useMemo(() => {
    if (usingFlashList) return emptyMap
    const sm = new Map<Types.Ordinal, Types.Ordinal>()
    let p = 0
    for (const o of _messageOrdinals) {
      sm.set(o, p)
      p = o
    }
    return sm
  }, [_messageOrdinals])

  const listRef = React.useRef<FlashList<ItemType> | FlatList<ItemType> | null>(null)
  const {markInitiallyLoadedThreadAsRead} = Hooks.useActions({conversationIDKey})
  const keyExtractor = React.useCallback((ordinal: ItemType) => {
    return String(ordinal)
  }, [])

  const renderItem = React.useCallback(
    (info: ListRenderItemInfo<ItemType> | null | undefined) => {
      const index = info?.index ?? 0
      const ordinal = messageOrdinals[index]
      if (!ordinal) {
        return null
      }

      if (!index) {
        return <Sent ordinal={ordinal} />
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
  React.useEffect(() => {
    recycleTypeRef.current = new Map()
  }, [conversationIDKey, extraData])
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
    conversationIDKey,
    listRef,
    messageOrdinals,
    requestScrollToBottomRef,
  })

  const jumpToRecent = Hooks.useJumpToRecent(conversationIDKey, scrollToBottom, messageOrdinals.length)

  Container.useDepChangeEffect(() => {
    centeredOrdinal && scrollToCentered()
  }, [centeredOrdinal, scrollToCentered])

  React.useEffect(() => {
    if (!markedInitiallyLoaded) {
      markedInitiallyLoaded = true
      markInitiallyLoadedThreadAsRead()
    }
  }, [markInitiallyLoadedThreadAsRead])

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
      const {props, state} = listRef.current
      const {extraData, data} = props

      // @ts-ignore
      const layoutManager = state?.layoutProvider?._lastLayoutManager ?? ({} as any)
      const {_layouts, _renderWindowSize, _totalHeight, _totalWidth} = layoutManager
      // @ts-ignore
      const mm = window.DEBUGStore.store.getState().chat2.messageMap.get(conversationIDKey)
      // const reduxItems = messageOrdinals.map(o => ({o, type: mm.get(o)?.type}))

      console.log(listRef.current)

      const items = data?.map((ordinal, idx) => {
        const layout = _layouts?.[idx]
        const m = mm.get(ordinal) ?? ({} as any)
        return {
          idx,
          layout,
          ordinal,
          rid: m.id,
          rtype: m.type,
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
    } as const)
)

export default ConversationList
