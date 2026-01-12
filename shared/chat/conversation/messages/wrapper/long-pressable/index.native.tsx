import * as Chat from '@/stores/chat2'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import type {Props} from '.'
import {useOrdinal} from '../../ids-context'
// Perf issues w/ old arch so using old impl now
//import Swipeable, {type SwipeableMethods} from 'react-native-gesture-handler/ReanimatedSwipeable'
import {SwipeTrigger as OldSwipeTrigger} from './swipeable.native'
import {Pressable, Keyboard} from 'react-native'
import {FocusContext} from '@/chat/conversation/normal/context'
import * as Reanimated from 'react-native-reanimated'
// import {useDebugLayout} from '@/util/debug-react'

// const ReplyIcon = React.memo(function ({progress}: {progress: Reanimated.SharedValue<number>}) {
const ReplyIcon = React.memo(function ReplyIcon() {
  // const as = Reanimated.useAnimatedStyle(() => {
  //   const opacity = Reanimated.interpolate(progress.value, [0, -20], [0, 1], Reanimated.Extrapolation.CLAMP)
  //   return {opacity}
  // })
  const as = {opacity: 1}
  return (
    <Reanimated.default.View style={[styles.reply, as]}>
      <Kb.Icon type="iconfont-reply" style={styles.replyIcon} />
    </Reanimated.default.View>
  )
})

const LongPressable = React.memo(function LongPressable(props: Props) {
  const {children, onLongPress, style} = props

  const onPress = React.useCallback(() => Keyboard.dismiss(), [])

  // uncomment to debug measuring issues w/ items
  // const onLayout =
  //   useDebugLayout()
  // React.useCallback(() => {
  //   const {conversationIDKey, ordinal} = getIds()
  //   return global.DEBUGStore.store.getState().chat2.messageMap.get(conversationIDKey)?.get(ordinal)
  // }, [getIds])

  const inner = (
    <Pressable
      style={[styles.pressable, style]}
      onLongPress={onLongPress}
      onPress={onPress}
      // uncomment to debug measuring issues w/ items
      // onLayout={onLayout}
    >
      {children}
    </Pressable>
  )

  const makeAction = React.useCallback(
    (/*_: unknown, progress: Reanimated.SharedValue<number>*/) => <ReplyIcon /*progress={progress}*/ />,
    []
  )

  const toggleThreadSearch = Chat.useChatContext(s => s.dispatch.toggleThreadSearch)
  const setReplyTo = Chat.useChatContext(s => s.dispatch.setReplyTo)
  const ordinal = useOrdinal()
  const {focusInput} = React.useContext(FocusContext)
  const onSwipeLeft = React.useCallback(() => {
    setReplyTo(ordinal)
    toggleThreadSearch(true)
    focusInput()
  }, [setReplyTo, toggleThreadSearch, ordinal, focusInput])

  return (
    <OldSwipeTrigger actionWidth={100} onSwiped={onSwipeLeft} makeAction={makeAction}>
      {inner}
    </OldSwipeTrigger>
  )

  // TODO try and bring back w/ new arch
  // const swipeRef = React.useRef<SwipeableMethods | null>(null)
  // const onSwipeableWillOpen = React.useCallback(
  //   (dir: 'left' | 'right') => {
  //     if (dir === 'right') {
  //       swipeRef.current?.close()
  //       onSwipeLeft()
  //     }
  //   },
  //   [onSwipeLeft]
  // )
  // return (
  //   <Swipeable
  //     enabled={false}
  //     ref={swipeRef}
  //     renderRightActions={makeAction}
  //     onSwipeableWillOpen={onSwipeableWillOpen}
  //     overshootRight={false}
  //     // we don't do left swipe else it'll eat swipe back in nav
  //     dragOffsetFromLeftEdge={1000}
  //   >
  //     {inner}
  //   </Swipeable>
  // )
})

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      pressable: {
        flexDirection: 'row',
        paddingBottom: 3,
        paddingRight: Kb.Styles.globalMargins.tiny,
        paddingTop: 3,
      },
      reply: {
        alignSelf: 'flex-end',
        justifyContent: 'flex-end',
      },
      replyIcon: {paddingRight: Kb.Styles.globalMargins.small},
      view: {
        ...Kb.Styles.globalStyles.flexBoxColumn,
        position: 'relative',
      },
    }) as const
)

export default LongPressable
