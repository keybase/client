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
import {FocusContext} from '@/chat/conversation/normal/context'
import {useAdaptiveRender} from '@legendapp/list/react-native'

function ReplyIcon({progress}: {progress: Animated.Value}) {
  const opacity = progress.interpolate({inputRange: [-20, 0], outputRange: [1, 0], extrapolate: 'clamp'})
  return (
    <Animated.View style={[styles.reply, {opacity}]}>
      <Kb.Icon type="iconfont-reply" style={styles.replyIcon} />
    </Animated.View>
  )
}

function LongPressable(props: Props & {ref?: React.Ref<Kb.MeasureRef>}) {
  if (!isMobile) {
    return <Kb.Box2 direction="horizontal" fullWidth={true} {...props} />
  }
  return <LongPressableMobile {...props} />
}

function LongPressableMobile(props: Props & {ref?: React.Ref<Kb.MeasureRef>}) {
  const toggleThreadSearch = useConversationThreadToggleSearch()
  const setReplyTo = InputState.useConversationInputDispatch(s => s.setReplyTo)
  const ordinal = useOrdinal()
  const {focusInput} = React.useContext(FocusContext)
  const swipeRef = React.useRef<SwipeableMethods | null>(null)
  // Velocity-driven signal from LegendList: during fast scroll it flips to "light". We keep the
  // Swipeable mounted (toggling its tree would remount children and flash images) and instead just
  // disable its pan handlers in light mode, shedding the per-row touch evaluation during the fling.
  const adaptiveMode = useAdaptiveRender()

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
      enabled={adaptiveMode !== 'light'}
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
