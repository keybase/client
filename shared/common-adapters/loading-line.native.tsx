import * as React from 'react'
import * as Styles from '../styles'
import Animated, {withRepeat, useSharedValue, withTiming, useAnimatedStyle, withDelay} from './reanimated'

const LoadingLine = React.memo(function LoadingLine() {
  const opacity = useSharedValue(0)
  opacity.value = withDelay(1000, withRepeat(withTiming(1, {duration: 600}), -1, true))
  const animatedStyle = useAnimatedStyle(() => ({opacity: opacity.value}))
  return <Animated.View style={[styles.line, animatedStyle]} />
})

const styles = Styles.styleSheetCreate(
  () =>
    ({
      line: {
        backgroundColor: Styles.globalColors.blue,
        height: 1,
        position: 'absolute',
        width: '100%',
      },
    } as const)
)

export default LoadingLine
