import * as React from 'react'
import ReAnimated, {withRepeat, useSharedValue, withTiming, useAnimatedStyle, withDelay} from './reanimated'
import * as Styles from '../styles'

const LoadingLine = React.memo(() => {
  const opacity = useSharedValue(0)
  opacity.value = withDelay(1000, withRepeat(withTiming(1, {duration: 600}), -1, true))
  const animatedStyle = useAnimatedStyle(() => ({opacity: opacity.value}))
  return <ReAnimated.View style={[styles.line, animatedStyle]} />
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
