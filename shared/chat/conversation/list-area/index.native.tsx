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
// import {mobileTypingContainerHeight} from '../input-area/normal/typing'
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
  minIndexForVisible: 0,
}

const useScrolling = (p: {
  centeredOrdinal: Types.Ordinal | undefined
  messageOrdinalsPlus: Array<Types.Ordinal>
  conversationIDKey: Types.ConversationIDKey
  listRef: React.MutableRefObject<Kb.NativeVirtualizedList<ItemType> | null>
}) => {
  const {listRef, centeredOrdinal, messageOrdinalsPlus, conversationIDKey} = p
  const scrollCenterTargetRef = React.useRef<number | undefined>()

  const dispatch = Container.useDispatch()
  const lastLoadOrdinal = React.useRef<Types.Ordinal>(-1)
  const oldestOrdinal = messageOrdinalsPlus[messageOrdinalsPlus.length - 2] ?? -1
  const loadOlderMessages = Container.useThrottledCallback(
    React.useCallback(() => {
      // already loaded and nothing has changed
      if (lastLoadOrdinal.current === oldestOrdinal) {
        console.log('aaa bail on load older', lastLoadOrdinal.current)
        return
      } else {
        console.log('aaa actually load older', lastLoadOrdinal.current, oldestOrdinal)
      }
      lastLoadOrdinal.current = oldestOrdinal
      dispatch(Chat2Gen.createLoadOlderMessagesDueToScroll({conversationIDKey}))
    }, [dispatch, conversationIDKey, oldestOrdinal]),
    200
  )

  // const getIndexFromItem = React.useCallback(
  //   (item: number) => getItemCount(messageOrdinalsPlus) - item - 2,
  //   [getItemCount, messageOrdinalsPlus]
  // )

  const getOrdinalIndex = React.useCallback(
    (target: Types.Ordinal) => {
      // TODO binary
      for (let item = 0; item < messageOrdinalsPlus.length; item++) {
        const ordinal = messageOrdinalsPlus[item] || 0
        if (ordinal === target) {
          return item
        }
      }
      return -1
    },
    [messageOrdinalsPlus]
  )

  const scrollToBottom = React.useCallback(() => {
    const list = listRef.current
    if (list) {
      const index = messageOrdinalsPlus.length - 1
      // const index = getOrdinalIndex(messageOrdinalsPlus[messageOrdinalsPlus.length - 1])
      if (index >= 0) {
        list.scrollToIndex({index})
      }
    }
  }, [listRef, /*getOrdinalIndex, */ messageOrdinalsPlus])

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
  const _onViewableItemsChanged = React.useCallback(
    ({viewableItems}: {viewableItems: Array<{item: ItemType}>}) => {
      const topRecord = viewableItems[viewableItems.length - 1]
      const bottomRecord = viewableItems[0]
      // console.log('aaa _onViewableItemsChanged ', topRecord, bottomRecord)
      // we scroll back in time if the specialTop item is the last viewable, *unless* we are currently
      // attempting to scroll to a centered ordinal
      if (!scrollCenterTargetRef.current && topRecord?.item === topOrdinal) {
        const ordinalRecord = viewableItems[viewableItems.length - 2]
        // ignore if we don't have real messages
        if (ordinalRecord && ordinalRecord.item !== bottomOrdinal && ordinalRecord.item !== topOrdinal) {
          // console.log('aaa load older ')
          loadOlderMessages()
        } else {
          // console.log('aaa NOT load older ')
        }
      }
      if (!topRecord || !bottomRecord) {
        // console.log('aaa bail early 1')
        return
      }

      const bottomIndex = messageOrdinalsPlus.length - 1
      const upperIndex = 0
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
    [scrollCenterTargetRef, loadOlderMessages, messageOrdinalsPlus, scrollToCentered]
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

const topOrdinal = -1
const bottomOrdinal = -2

const ConversationList = React.memo((p: {conversationIDKey: Types.ConversationIDKey}) => {
  const {conversationIDKey} = p
  const centeredOrdinal = Container.useSelector(
    state => Constants.getMessageCenterOrdinal(state, conversationIDKey)?.ordinal
  )
  const messageOrdinalsSet = Container.useSelector(state =>
    Constants.getMessageOrdinals(state, conversationIDKey)
  )
  const messageOrdinalsPlus = useMemo(() => [-1, ...messageOrdinalsSet, -2].reverse(), [messageOrdinalsSet])
  // const isMountedRef = Hooks.useIsMounted()
  const listRef = React.useRef<Kb.NativeFlatList<ItemType> | null>(null)
  const {markInitiallyLoadedThreadAsRead} = Hooks.useActions({conversationIDKey})

  // the component can pass null here sometimes
  // const getItemCount = React.useCallback(
  //   (messageOrdinalsPlus: Array<Types.Ordinal> | null) => {
  //     if (isMountedRef.current) {
  //       return (messageOrdinalsPlus?.length ?? 0) + 2
  //     } else {
  //       // needed else VirtualizedList will yellowbox
  //       return 0
  //     }
  //   },
  //   [isMountedRef]
  // )

  const keyExtractor = React.useCallback((item: ItemType) => String(item), [])

  // const getItem = React.useCallback(
  //   (messageOrdinalsPlus: Array<Types.Ordinal>, index: number) => {
  //     // Note we invert our list so we need to feed it things in the reverse order. We just invert the index
  //     // vs reversing the items to speed things up
  //     const itemCountIncludingSpecial = getItemCount(messageOrdinalsPlus)
  //     if (index === itemCountIncludingSpecial - 1) {
  //       return 'specialTop'
  //     } else if (index === 0) {
  //       return 'specialBottom'
  //     }

  //     // return ordinalIndex
  //     const ordinalIndex = itemCountIncludingSpecial - index - 2
  //     return ordinalIndex
  //   },
  //   [getItemCount]
  // )

  const renderItem = React.useCallback(
    (i: ListRenderItemInfo<ItemType>) => {
      const {item, index} = i
      if (item === topOrdinal) {
        return <SpecialTopMessage conversationIDKey={conversationIDKey} />
      } else if (item === bottomOrdinal) {
        return <SpecialBottomMessage conversationIDKey={conversationIDKey} />
      } else {
        const ordinal = item
        const prevOrdinal = index > 0 ? messageOrdinalsPlus[index - 1] : undefined

        if (!ordinal) {
          return null
        }

        if (messageOrdinalsPlus.length - 2 === index) {
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
    [messageOrdinalsPlus, conversationIDKey]
  )

  const {scrollToCentered, onScrollToIndexFailed, scrollToBottom, viewabilityConfigCallbackPairsRef} =
    useScrolling({
      centeredOrdinal,
      conversationIDKey,
      listRef,
      messageOrdinalsPlus,
    })

  const jumpToRecent = Hooks.useJumpToRecent(conversationIDKey, scrollToBottom, messageOrdinalsPlus.length)

  Container.useDepChangeEffect(() => {
    centeredOrdinal && scrollToCentered()
  }, [centeredOrdinal, scrollToCentered])

  React.useEffect(() => {
    if (!markedInitiallyLoaded) {
      markedInitiallyLoaded = true
      markInitiallyLoadedThreadAsRead()
    }
  }, [markInitiallyLoadedThreadAsRead])

  // console.log('aaa ord num', messageOrdinalsPlus.length)

  return (
    <Kb.ErrorBoundary>
      <Kb.Box style={styles.container}>
        <Kb.NativeFlatList
          overScrollMode="never"
          contentContainerStyle={styles.contentContainer}
          data={messageOrdinalsPlus}
          inverted={true}
          // getItem={getItem}
          // getItemCount={getItemCount}
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
    </Kb.ErrorBoundary>
  )
})

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {
        flex: 1,
        position: 'relative',
      },
      contentContainer: {
        /*bottom: -mobileTypingContainerHeight*/
      },
    } as const)
)

export default ConversationList
