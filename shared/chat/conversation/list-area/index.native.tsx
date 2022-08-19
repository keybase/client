import * as Container from '../../../util/container'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Constants from '../../../constants/chat2'
import * as Kb from '../../../common-adapters/mobile.native'
import * as React from 'react'
import * as Styles from '../../../styles'
import * as Types from '../../../constants/types/chat2'
import Message from '../messages'
import SpecialBottomMessage from '../messages/special-bottom-message'
import SpecialTopMessage from '../messages/special-top-message'
import logger from '../../../logger'
import {useMemo} from '../../../util/memoize'
import {Animated, type ListRenderItemInfo} from 'react-native'
import type {ItemType} from '.'
import {mobileTypingContainerHeight} from '../input-area/normal/typing'
import * as Hooks from './hooks'

const targetHitArea = 1

// Bookkeep whats animating so it finishes and isn't replaced, if we've animated it we keep the key and use null
const animatingMap = new Map<string, null | React.ReactElement>()

type AnimatedChildProps = {
  animatingKey: string
  children: React.ReactNode
}
const AnimatedChild = React.memo(({children, animatingKey}: AnimatedChildProps) => {
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
  const message = Container.useSelector(state => state.chat2.messageMap.get(conversationIDKey)?.get(ordinal))
  const youSent = message && message.author === you && message.ordinal !== message.id
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
  minIndexForVisible: 0,
}

const useScrolling = (p: {
  centeredOrdinal: Types.Ordinal | undefined
  getItemCount: (messageOrdinals: Array<Types.Ordinal> | null) => number
  messageOrdinals: Array<Types.Ordinal>
  conversationIDKey: Types.ConversationIDKey
  listRef: React.MutableRefObject<Kb.NativeVirtualizedList<ItemType> | null>
}) => {
  const {listRef, centeredOrdinal, messageOrdinals, getItemCount, conversationIDKey} = p
  const scrollCenterTargetRef = React.useRef<number | undefined>()

  const dispatch = Container.useDispatch()
  const loadOlderMessages = Container.useThrottledCallback(
    React.useCallback(() => {
      dispatch(Chat2Gen.createLoadOlderMessagesDueToScroll({conversationIDKey}))
    }, [dispatch, conversationIDKey]),
    200
  )

  const getIndexFromItem = React.useCallback(
    (item: number) => getItemCount(messageOrdinals) - item - 2,
    [getItemCount, messageOrdinals]
  )

  const getOrdinalIndex = React.useCallback(
    (target: Types.Ordinal) => {
      for (let item = 0; item < messageOrdinals.length; item++) {
        const ordinal = messageOrdinals[item] || 0
        if (ordinal === target) {
          return getIndexFromItem(item)
        }
      }
      return -1
    },
    [getIndexFromItem, messageOrdinals]
  )

  const scrollToBottom = React.useCallback(() => {
    const list = listRef.current
    if (list) {
      const index = getOrdinalIndex(messageOrdinals[messageOrdinals.length - 1])
      if (index >= 0) {
        list.scrollToIndex({index})
      }
    }
  }, [listRef, getOrdinalIndex, messageOrdinals])

  const scrollToCentered = React.useCallback(() => {
    const list = listRef.current
    if (!list) {
      return
    }
    const _index = centeredOrdinal === undefined ? -1 : getOrdinalIndex(centeredOrdinal)
    if (_index >= 0) {
      const index = _index + 1 // include the top item
      scrollCenterTargetRef.current = index
      list.scrollToIndex({animated: false, index, viewPosition: 0.5})
    }
  }, [listRef, scrollCenterTargetRef, centeredOrdinal, getOrdinalIndex])

  // Was using onEndReached but that was really flakey
  const onViewableItemsChanged = React.useCallback(
    ({viewableItems}: {viewableItems: Array<{item: ItemType}>}) => {
      const topRecord = viewableItems[viewableItems.length - 1]
      const bottomRecord = viewableItems[0]
      // we scroll back in time if the specialTop item is the last viewable, *unless* we are currently
      // attempting to scroll to a centered ordinal
      if (!scrollCenterTargetRef.current && topRecord?.item === 'specialTop') {
        const ordinalRecord = viewableItems[viewableItems.length - 2]
        // ignore if we don't have real messages
        if (ordinalRecord && ordinalRecord.item !== 'specialBottom' && ordinalRecord.item !== 'specialTop') {
          loadOlderMessages()
        }
      }
      if (!topRecord || !bottomRecord) {
        return
      }

      const bottomIndex =
        typeof bottomRecord.item === 'number'
          ? getIndexFromItem(bottomRecord.item)
          : messageOrdinals.length - 1
      const upperIndex = typeof topRecord.item === 'number' ? getIndexFromItem(topRecord.item) : 0
      const middleIndex = bottomIndex + Math.floor((upperIndex - bottomIndex) / 2)

      if (!scrollCenterTargetRef.current) {
        return
      }

      if (
        !(
          scrollCenterTargetRef.current <= middleIndex + targetHitArea &&
          scrollCenterTargetRef.current >= middleIndex - targetHitArea
        )
      ) {
        scrollToCentered()
      } else {
        scrollCenterTargetRef.current = undefined
      }
    },
    [scrollCenterTargetRef, loadOlderMessages, messageOrdinals, getIndexFromItem, scrollToCentered]
  )

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
    onViewableItemsChanged,
    scrollToBottom,
    scrollToCentered,
  }
}

const ConversationList = (p: {conversationIDKey: Types.ConversationIDKey}) => {
  const {conversationIDKey} = p
  const centeredOrdinal = Container.useSelector(
    state => Constants.getMessageCenterOrdinal(state, conversationIDKey)?.ordinal
  )
  const messageOrdinalsSet = Container.useSelector(state =>
    Constants.getMessageOrdinals(state, conversationIDKey)
  )
  const messageOrdinals = useMemo(() => [...messageOrdinalsSet], [messageOrdinalsSet])
  const isMountedRef = Hooks.useIsMounted()
  const listRef = React.useRef<Kb.NativeVirtualizedList<ItemType> | null>(null)
  const {markInitiallyLoadedThreadAsRead} = Hooks.useActions({conversationIDKey})

  // the component can pass null here sometimes
  const getItemCount = React.useCallback(
    (messageOrdinals: Array<Types.Ordinal> | null) => {
      if (isMountedRef.current) {
        return (messageOrdinals?.length ?? 0) + 2
      } else {
        // needed else VirtualizedList will yellowbox
        return 0
      }
    },
    [isMountedRef]
  )

  const keyExtractor = React.useCallback(
    (item: ItemType) => {
      if (item === 'specialTop') {
        return 'specialTop'
      }
      if (item === 'specialBottom') {
        return 'specialBottom'
      }
      return String(messageOrdinals[item])
    },
    [messageOrdinals]
  )

  const getItem = React.useCallback(
    (messageOrdinals: Array<Types.Ordinal>, index: number) => {
      // Note we invert our list so we need to feed it things in the reverse order. We just invert the index
      // vs reversing the items to speed things up
      const itemCountIncludingSpecial = getItemCount(messageOrdinals)
      if (index === itemCountIncludingSpecial - 1) {
        return 'specialTop'
      } else if (index === 0) {
        return 'specialBottom'
      }

      // return ordinalIndex
      const ordinalIndex = itemCountIncludingSpecial - index - 2
      return ordinalIndex
    },
    [getItemCount]
  )

  const renderItem = React.useCallback(
    (i: ListRenderItemInfo<ItemType>) => {
      const {item} = i
      if (item === 'specialTop') {
        return <SpecialTopMessage conversationIDKey={conversationIDKey} />
      } else if (item === 'specialBottom') {
        return <SpecialBottomMessage conversationIDKey={conversationIDKey} />
      } else {
        const ordinalIndex = item
        const ordinal = messageOrdinals[ordinalIndex]
        const prevOrdinal = ordinalIndex > 0 ? messageOrdinals[ordinalIndex - 1] : undefined

        if (!ordinal) {
          return null
        }

        if (messageOrdinals.length - 1 === ordinalIndex) {
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
      }
    },
    [messageOrdinals, conversationIDKey]
  )

  const {scrollToCentered, onViewableItemsChanged, onScrollToIndexFailed, scrollToBottom} = useScrolling({
    centeredOrdinal,
    conversationIDKey,
    getItemCount,
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

  return (
    <Kb.ErrorBoundary>
      <Kb.Box style={styles.container}>
        <Kb.NativeVirtualizedList
          overScrollMode="never"
          contentContainerStyle={styles.contentContainer}
          data={messageOrdinals}
          inverted={true}
          getItem={getItem}
          getItemCount={getItemCount}
          renderItem={renderItem}
          maintainVisibleContentPosition={maintainVisibleContentPosition}
          onViewableItemsChanged={onViewableItemsChanged}
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
    </Kb.ErrorBoundary>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {
        flex: 1,
        position: 'relative',
      },
      contentContainer: {bottom: -mobileTypingContainerHeight},
    } as const)
)

export default ConversationList
