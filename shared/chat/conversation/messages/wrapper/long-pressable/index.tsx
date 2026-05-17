import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as InputState from '../../../input-area/input-state'
import * as Reanimated from 'react-native-reanimated'
import {Pressable, Keyboard} from 'react-native'
import type {Props} from './index.shared'
import {useOrdinal} from '../../ids-context'
import {useConversationThreadToggleSearch} from '../../../thread-context'
import Swipeable, {type SwipeableMethods} from '@/common-adapters/swipeable-row'
import {FocusContext} from '@/chat/conversation/normal/context'

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

function LongPressable(props: Props & {ref?: React.Ref<Kb.MeasureRef>}) {
  const toggleThreadSearch = useConversationThreadToggleSearch()
  const setReplyTo = InputState.useConversationInputDispatch(s => s.setReplyTo)
  const ordinal = useOrdinal()
  const {focusInput} = React.useContext(FocusContext)
  const swipeRef = React.useRef<SwipeableMethods | null>(null)

  if (!Kb.Styles.isMobile) {
    return <Kb.Box2 direction="horizontal" fullWidth={true} {...props} />
  }

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

  const onSwipeLeft = () => {
    setReplyTo(ordinal)
    toggleThreadSearch(true)
    focusInput()
  }

  const onSwipeableWillOpen = () => {
    swipeRef.current?.close()
    onSwipeLeft()
  }

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={makeAction}
      onSwipeableWillOpen={onSwipeableWillOpen}
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
