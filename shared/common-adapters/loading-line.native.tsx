import * as React from 'react'
import * as Styles from '@/styles'
import Animated, {withRepeat, useSharedValue, withTiming, useAnimatedStyle, withDelay} from './reanimated'

const LoadingLine = React.memo(function LoadingLine() {
  'use no memo'
  const opacity = useSharedValue(1)
  React.useEffect(() => {
    opacity.set(withDelay(1000, withRepeat(withTiming(0, {duration: 600}), -1, true)))
  }, [opacity])
  const backgroundColor = Styles.undynamicColor(Styles.globalColors.blue)
  const animatedStyle = useAnimatedStyle(() => {
    return {
      backgroundColor,
      opacity: opacity.value,
    }
  })
  return <Animated.View style={[styles.line, animatedStyle]} />
})

const styles = Styles.styleSheetCreate(
  () =>
    ({
      line: {
        height: 1,
        position: 'absolute',
        width: '100%',
      },
    }) as const
)

export default LoadingLine
