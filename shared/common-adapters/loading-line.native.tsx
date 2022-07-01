import * as React from 'react'
import {
  withRepeat,
  useSharedValue,
  withTiming,
  useAnimatedStyle,
  withDelay,
  createAnimatedComponent,
} from './reanimated'
import {View} from 'react-native'
import * as Styles from '../styles'

const AnimatedView = createAnimatedComponent(View)
const LoadingLine = React.memo(() => {
  const opacity = useSharedValue(0)
  opacity.value = withDelay(1000, withRepeat(withTiming(1, {duration: 600}), -1, true))
  const animatedStyle = useAnimatedStyle(() => ({opacity: opacity.value}))
  return <AnimatedView style={[styles.line, animatedStyle]} />
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
