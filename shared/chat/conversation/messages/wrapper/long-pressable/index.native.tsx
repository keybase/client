import * as ConvoState from '@/stores/convostate'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import type {Props} from '.'
import {useOrdinal} from '../../ids-context'
import Swipeable, {
  type SwipeableMethods,
  SwipeDirection,
} from 'react-native-gesture-handler/ReanimatedSwipeable'
import {Pressable, Keyboard} from 'react-native'
import {FocusContext} from '@/chat/conversation/normal/context'
import * as Reanimated from 'react-native-reanimated'

function ReplyIcon({progress}: {progress: Reanimated.SharedValue<number>}) {
  const as = Reanimated.useAnimatedStyle(() => {
    const opacity = Reanimated.interpolate(progress.value, [0, -20], [0, 1], Reanimated.Extrapolation.CLAMP)
    return {opacity}
  })
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
    <Pressable style={[styles.pressable, style]} onLongPress={onLongPress} onPress={onPress}>
      {children}
    </Pressable>
  )

  const makeAction = (
    _progress: Reanimated.SharedValue<number>,
    translation: Reanimated.SharedValue<number>
  ) => <ReplyIcon progress={translation} />

  const toggleThreadSearch = ConvoState.useChatContext(s => s.dispatch.toggleThreadSearch)
  const setReplyTo = ConvoState.useChatUIContext(s => s.dispatch.setReplyTo)
  const ordinal = useOrdinal()
  const {focusInput} = React.useContext(FocusContext)
  const onSwipeLeft = () => {
    setReplyTo(ordinal)
    toggleThreadSearch(true)
    focusInput()
  }

  const swipeRef = React.useRef<SwipeableMethods | null>(null)
  const onSwipeableWillOpen = (dir: SwipeDirection) => {
    if (dir === SwipeDirection.RIGHT) {
      swipeRef.current?.close()
      onSwipeLeft()
    }
  }

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={makeAction}
      onSwipeableWillOpen={onSwipeableWillOpen}
      overshootRight={false}
      dragOffsetFromLeftEdge={1000}
    >
      {inner}
    </Swipeable>
  )
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
