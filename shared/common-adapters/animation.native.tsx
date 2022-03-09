import * as React from 'react'
import LottieView from 'lottie-react-native'
import ReAnimated, {useSharedValue, useAnimatedProps, withTiming, withRepeat} from 'react-native-reanimated'
import Box from './box'
import type {Props} from './animation'
import {useDepChangeEffect} from '../util/container'

const AnimatedLottieView = ReAnimated.createAnimatedComponent(LottieView)

const getDuration = (o: {ip: number; op: number; fr: number}) => {
  const {ip, op, fr} = o
  const duration = ((op - ip) / fr) * 1000
  return duration
}

const AnimationNew = React.memo((props: Props) => {
  const {animationType} = props
  const dataRef = React.useRef<any>()
  if (!dataRef.current) {
    dataRef.current = require('./animation-data.json')
  }

  const source = React.useRef(dataRef.current?.[animationType])
  const duration = React.useRef(getDuration(source.current))
  useDepChangeEffect(() => {
    const data = dataRef.current?.[animationType]
    source.current = data
    duration.current = getDuration(source.current)
  }, [animationType])

  const progress = useSharedValue(0)
  const animatedProps = useAnimatedProps(() => {
    return {progress: progress.value}
  })

  React.useEffect(() => {
    progress.value = withRepeat(withTiming(1, {duration: duration.current}), -1)
  }, [progress])

  return (
    <Box style={props.containerStyle}>
      <AnimatedLottieView
        autoPlay={true}
        loop={true}
        source={source.current}
        animatedProps={animatedProps}
        style={props.style}
      />
    </Box>
  )
})

export default AnimationNew
