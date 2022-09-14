import * as Container from '../../../util/container'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Constants from '../../../constants/chat2'
import * as Kb from '../../../common-adapters/mobile.native'
import * as React from 'react'
import * as Styles from '../../../styles'
import * as Types from '../../../constants/types/chat2'
import Message from '../messages'
import SpecialBottomMessage from '../messages/special-bottom-message'
import SpecialTopMessage from '../messages/special-top-message'
import logger from '../../../logger'
import {Animated, type ListRenderItemInfo, type ViewToken} from 'react-native'
import type {ItemType} from '.'
import {mobileTypingContainerHeight} from '../input-area/normal/typing'
import * as Hooks from './hooks'
import sortedIndexOf from 'lodash/sortedIndexOf'
import DropView, {type DropItems} from '../../../common-adapters/drop-view.native'

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
  return (
    <Animated.View
      style={{opacity, overflow: 'hidden', transform: [{translateY}], width: '100%'}}
      onLayout={(e: any) => {
        const {height} = e.nativeEvent.layout
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
  conversationIDKey: Types.ConversationIDKey
  ordinal: Types.Ordinal
  prevOrdinal: Types.Ordinal | undefined
}
const Sent_ = ({conversationIDKey, ordinal, prevOrdinal}: SentProps) => {
  const you = Container.useSelector(state => state.config.username)
  const youSent = Container.useSelector(state => {
    const message = state.chat2.messageMap.get(conversationIDKey)?.get(ordinal)
    return message && message.author === you && message.ordinal !== message.id
  })
  const key = `${conversationIDKey}:${ordinal}`
  const state = animatingMap.get(key)

  // if its animating always show it
  if (state) {
    return state
  }

  const children = (
    <Message key={ordinal} ordinal={ordinal} previous={prevOrdinal} conversationIDKey={conversationIDKey} />
  )

  // if state is null we already animated it
  if (youSent && state === undefined) {
    const c = <AnimatedChild animatingKey={key}>{children}</AnimatedChild>
    animatingMap.set(key, c)
    return c
  } else {
    return children || null
  }
}
const Sent = React.memo(Sent_)

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
  listRef: React.MutableRefObject<Kb.NativeVirtualizedList<ItemType> | null>
}) => {
  const {listRef, centeredOrdinal, messageOrdinals, conversationIDKey} = p
  const dispatch = Container.useDispatch()
  const lastLoadOrdinal = React.useRef<Types.Ordinal>(-1)
  const oldestOrdinal = messageOrdinals[0] ?? -1
  const loadOlderMessages = React.useCallback(() => {
    // already loaded and nothing has changed
    if (lastLoadOrdinal.current === oldestOrdinal) {
      return
    }
    lastLoadOrdinal.current = oldestOrdinal
    dispatch(Chat2Gen.createLoadOlderMessagesDueToScroll({conversationIDKey}))
  }, [dispatch, conversationIDKey, oldestOrdinal])

  const getOrdinalIndex = React.useCallback(
    (target: Types.Ordinal) => {
      const idx = sortedIndexOf(messageOrdinals, target)
      return idx === -1 ? -1 : messageOrdinals.length - idx
    },
    [messageOrdinals]
  )

  const scrollToBottom = React.useCallback(() => {
    listRef.current?.scrollToOffset({animated: false, offset: 0})
  }, [listRef])

  // only scroll to center once per
  const lastScrollToCentered = React.useRef(-1)
  React.useEffect(() => {
    lastScrollToCentered.current = -1
  }, [conversationIDKey])

  const scrollToCentered = React.useCallback(() => {
    const list = listRef.current
    if (!list) {
      return
    }
    if (lastScrollToCentered.current === centeredOrdinal) {
      return
    }

    lastScrollToCentered.current = centeredOrdinal
    const _index = centeredOrdinal === -1 ? -1 : getOrdinalIndex(centeredOrdinal)
    if (_index >= 0) {
      const index = _index + 1 // include the top item
      list.scrollToIndex({animated: false, index, viewPosition: 0.5})
    }
  }, [listRef, centeredOrdinal, getOrdinalIndex])

  // Was using onEndReached but that was really flakey
  const _onViewableItemsChanged = React.useCallback(
    ({viewableItems}: {viewableItems: Array<ViewToken>}) => {
      const topRecord = viewableItems[viewableItems.length - 1]
      const bottomRecord = viewableItems[0]
      if (typeof topRecord?.index !== 'number' || typeof bottomRecord?.index !== 'number') {
        return
      }
      // load more before we get to the top
      const triggerIndex = messageOrdinals.length - 10
      // we scroll back in time if the specialTop item is the last viewable, *unless* we are currently
      // attempting to scroll to a centered ordinal
      if (topRecord.index > triggerIndex) {
        loadOlderMessages()
      }
    },
    [loadOlderMessages, messageOrdinals]
  )
  // FlatList doesn't let you change this on the fly for some reason, so stash _onViewableItemsChanged into a ref and call it
  const _onViewableItemsChangedRef = React.useRef<typeof _onViewableItemsChanged>(() => {})
  _onViewableItemsChangedRef.current = a => _onViewableItemsChanged(a)
  const onViewableItemsChangedRef = React.useRef<typeof _onViewableItemsChanged>(a =>
    _onViewableItemsChangedRef.current(a)
  )
  const viewabilityConfigRef = React.useRef({viewAreaCoveragePercentThreshold: 0, waitForInteraction: true})
  const viewabilityConfigCallbackPairsRef = React.useRef([
    {
      onViewableItemsChanged: onViewableItemsChangedRef.current,
      viewabilityConfig: viewabilityConfigRef.current,
    },
  ])

  const onScrollToIndexFailed = React.useCallback(
    (info: {index: number; highestMeasuredFrameIndex: number; averageItemLength: number}) => {
      logger.warn(
        `scroll: onScrollToIndexFailed: failed to scroll to index: centeredOrdinal: ${Types.ordinalToNumber(
          centeredOrdinal || Types.numberToOrdinal(0)
        )} arg: ${JSON.stringify(info)}`
      )
      listRef.current?.scrollToIndex({animated: false, index: info.highestMeasuredFrameIndex})
    },
    [listRef, centeredOrdinal]
  )

  return {
    onScrollToIndexFailed,
    scrollToBottom,
    scrollToCentered,
    viewabilityConfigCallbackPairsRef,
  }
}

const ConversationList = React.memo(function ConversationList(p: {
  conversationIDKey: Types.ConversationIDKey
}) {
  const {conversationIDKey} = p
  const centeredOrdinal = Container.useSelector(
    state => Constants.getMessageCenterOrdinal(state, conversationIDKey)?.ordinal ?? -1
  )
  const messageOrdinals = Container.useSelector(state =>
    Constants.getMessageOrdinals(state, conversationIDKey)
  )
  const listRef = React.useRef<Kb.NativeFlatList<ItemType> | null>(null)
  const {markInitiallyLoadedThreadAsRead} = Hooks.useActions({conversationIDKey})
  const keyExtractor = React.useCallback(
    (_item: ItemType, idx: number) => {
      const index = messageOrdinals.length - 1 - idx
      const ordinal = messageOrdinals[index]
      return String(ordinal)
    },
    [messageOrdinals]
  )
  const renderItem = React.useCallback(
    (info: ListRenderItemInfo<ItemType>) => {
      // since the list is inverted but the data is not we flip the index when rendering and ignore `item`
      const index = messageOrdinals.length - 1 - info.index
      const ordinal = messageOrdinals[index]
      if (!ordinal) {
        return null
      }
      const prevOrdinal = index > 0 ? messageOrdinals[index - 1] : undefined
      if (messageOrdinals.length - 1 === index) {
        return (
          <Sent
            key={ordinal}
            ordinal={ordinal}
            prevOrdinal={prevOrdinal}
            conversationIDKey={conversationIDKey}
          />
        )
      }

      return (
        <Message
          key={ordinal}
          ordinal={ordinal}
          previous={prevOrdinal}
          conversationIDKey={conversationIDKey}
        />
      )
    },
    [messageOrdinals, conversationIDKey]
  )

  const {scrollToCentered, onScrollToIndexFailed, scrollToBottom, viewabilityConfigCallbackPairsRef} =
    useScrolling({
      centeredOrdinal,
      conversationIDKey,
      listRef,
      messageOrdinals,
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

  const listHeaderComponent = React.useMemo(
    function ListHeaderComponent() {
      return <SpecialBottomMessage conversationIDKey={conversationIDKey} />
    },
    [conversationIDKey]
  )
  const listFooterComponent = React.useMemo(
    function ListFooterComponent() {
      return <SpecialTopMessage conversationIDKey={conversationIDKey} />
    },
    [conversationIDKey]
  )

  const dispatch = Container.useDispatch()
  const onDropped = React.useCallback(
    (items: DropItems) => {
      const {attach, texts} = items.reduce(
        (obj, i) => {
          const {texts, attach} = obj
          if (i.content) {
            texts.push(i.content)
          } else if (i.originalPath) {
            attach.push({outboxID: null, path: i.originalPath})
          }
          return obj
        },
        {attach: new Array<{outboxID: null; path: string}>(), texts: new Array<string>()}
      )

      if (texts.length) {
        dispatch(
          Chat2Gen.createSetUnsentText({
            conversationIDKey,
            text: new Container.HiddenString(texts.join('\r')),
          })
        )
      }

      if (attach.length) {
        dispatch(
          RouteTreeGen.createNavigateAppend({
            path: [
              {props: {conversationIDKey, pathAndOutboxIDs: attach}, selected: 'chatAttachmentGetTitles'},
            ],
          })
        )
      }
    },
    [dispatch, conversationIDKey]
  )

  return (
    <Kb.ErrorBoundary>
      <DropView style={styles.drop} onDropped={onDropped}>
        <Kb.Box style={styles.container}>
          <Kb.NativeFlatList
            ListHeaderComponent={listHeaderComponent}
            ListFooterComponent={listFooterComponent}
            overScrollMode="never"
            contentContainerStyle={styles.contentContainer}
            data={messageOrdinals}
            inverted={true}
            renderItem={renderItem}
            maintainVisibleContentPosition={maintainVisibleContentPosition}
            viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairsRef.current}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            keyExtractor={keyExtractor}
            // Limit the number of pages rendered ahead of time (which also limits attachment previews loaded)
            windowSize={5}
            ref={listRef}
            onScrollToIndexFailed={onScrollToIndexFailed}
            removeClippedSubviews={Styles.isAndroid}
          />
          {jumpToRecent}
        </Kb.Box>
      </DropView>
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
      drop: {flexGrow: 1},
    } as const)
)

export default ConversationList
