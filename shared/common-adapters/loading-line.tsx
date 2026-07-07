import * as React from 'react'
import * as Styles from '@/styles'
import {Box2} from './box'
import Animated, {withRepeat, useSharedValue, withTiming, useAnimatedStyle, withDelay} from './reanimated'
import './loading-line.css'

function LoadingLine() {
  'use no memo'
  const opacity = useSharedValue(1)
  React.useEffect(() => {
    if (!isMobile) return
    opacity.set(withDelay(1000, withRepeat(withTiming(0, {duration: 600}), -1, true)))
  }, [opacity])

  const backgroundColor = Styles.undynamicColor(Styles.globalColors.blue)
  const animatedStyle = useAnimatedStyle(() => {
    return {
      backgroundColor,
      opacity: opacity.value,
    }
  })

  if (!isMobile) {
    return (
      <Box2 direction="vertical" fullWidth={true} style={styles.container}>
        <Box2 direction="vertical" fullWidth={true} className="loading-line" style={styles.line} />
      </Box2>
    )
  }

  return <Animated.View style={[styles.nativeLine, animatedStyle]} />
}

const styles = Styles.styleSheetCreate(() => ({
  container: {
    left: 0,
    position: 'absolute',
    top: 0,
  },
  line: {
    backgroundColor: Styles.globalColors.blue,
    height: 1,
  },
  nativeLine: {
    height: 1,
    position: 'absolute',
    width: '100%',
  },
}))

export default LoadingLine
