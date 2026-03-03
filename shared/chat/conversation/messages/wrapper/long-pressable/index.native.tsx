import * as C from '@/constants'
import * as Chat from '@/stores/chat'
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

// const ReplyIcon = React.memo(function ({progress}: {progress: Reanimated.SharedValue<number>}) {
function ReplyIcon() {
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
}

function LongPressable(props: Props) {
  const {children, onLongPress, style} = props

  const onPress = () => Keyboard.dismiss()

  const inner = (
    <Pressable
      style={[styles.pressable, style]}
      onLongPress={onLongPress}
      onPress={onPress}
    >
      {children}
    </Pressable>
  )

  const makeAction = (/*_: unknown, progress: Reanimated.SharedValue<number>*/) => <ReplyIcon /*progress={progress}*/ />

  const {toggleThreadSearch, setReplyTo} = Chat.useChatContext(
    C.useShallow(s => ({setReplyTo: s.dispatch.setReplyTo, toggleThreadSearch: s.dispatch.toggleThreadSearch}))
  )
  const ordinal = useOrdinal()
  const {focusInput} = React.useContext(FocusContext)
  const onSwipeLeft = () => {
    setReplyTo(ordinal)
    toggleThreadSearch(true)
    focusInput()
  }

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
  //   )
}

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
    }) as const
)

export default LongPressable
