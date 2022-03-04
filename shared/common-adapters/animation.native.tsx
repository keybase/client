import * as React from 'react'
import LottieView from 'lottie-react-native'
import Animated, {useSharedValue, useAnimatedProps, withTiming} from 'react-native-reanimated'
import Box from './box'
import type {Props} from './animation'

const AnimatedLottieView = Animated.createAnimatedComponent(LottieView)

const Animation = (props: Props) => {
  const dataRef = React.useRef()
  if (!dataRef.current) {
    dataRef.current = require('./animation-data.json')
  }
  const progress = useSharedValue(0)
  const animatedProps = useAnimatedProps(() => {
    return {
      progress: progress.value,
    }
  })

  React.useEffect(() => {
    progress.value = withTiming(1)
  }, [progress])
  return (
    <Box style={props.containerStyle}>
      <AnimatedLottieView
        autoPlay={true}
        loop={true}
        source={dataRef.current[props.animationType]}
        animatedProps={animatedProps}
        style={props.style}
      />
    </Box>
  )
}

export default Animation
