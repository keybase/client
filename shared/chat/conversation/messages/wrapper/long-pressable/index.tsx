import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as InputState from '../../../input-area/input-state'
import {Animated, Pressable, Keyboard} from 'react-native'
import {useOrdinal} from '../../ids-context'

type Props = {
  children: React.ReactNode
  onLongPress?: () => void
  onSwipeLeft?: () => void
  style?: Kb.Styles.StylesCrossPlatform
  className?: string
  onContextMenu?: () => void
  onMouseOver?: () => void
}
import {useConversationThreadToggleSearch} from '../../../thread-context'
import Swipeable, {type SwipeableMethods} from '@/common-adapters/swipeable-row'
import {ThreadRefsContext} from '@/chat/conversation/normal/context'

function ReplyIcon({progress}: {progress: Animated.Value}) {
  const opacity = progress.interpolate({inputRange: [-20, 0], outputRange: [1, 0], extrapolate: 'clamp'})
  return (
    <Animated.View style={[styles.reply, {opacity}]}>
      <Kb.Icon type="iconfont-reply" style={styles.replyIcon} />
    </Animated.View>
  )
}

function LongPressable(props: Props & {ref?: React.Ref<Kb.MeasureRef>}) {
  const toggleThreadSearch = useConversationThreadToggleSearch()
  const setReplyTo = InputState.useConversationInputDispatch(s => s.setReplyTo)
  const ordinal = useOrdinal()
  const {focusInput} = React.useContext(ThreadRefsContext)
  const swipeRef = React.useRef<SwipeableMethods | null>(null)

  if (!isMobile) {
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
    _progress: Animated.AnimatedDivision<number>,
    translation: Animated.Value
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
