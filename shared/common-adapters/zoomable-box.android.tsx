import * as React from 'react'
import type {Props} from './zoomable-box'
import {GestureDetector, Gesture} from 'react-native-gesture-handler'
import Animated, {useSharedValue, useAnimatedStyle} from 'react-native-reanimated'

const ZoomableBox = (p: Props) => {
  const {children, style} = p
  const scale = useSharedValue(1)
  const savedScale = useSharedValue(1)
  const pinchGesture = Gesture.Pinch()
    .onUpdate(e => {
      scale.value = savedScale.value * e.scale
    })
    .onEnd(() => {
      savedScale.value = scale.value
    })

  const positionX = useSharedValue(0)
  const positionY = useSharedValue(0)
  const savedPositionX = useSharedValue(0)
  const savedPositionY = useSharedValue(0)

  const panGesture = Gesture.Pan()
    .onUpdate(e => {
      positionX.value = savedPositionX.value + e.translationX
      positionY.value = savedPositionY.value + e.translationY
    })
    .onEnd(() => {
      savedPositionX.value = positionX.value
      savedPositionY.value = positionY.value
    })

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{translateX: positionX.value}, {translateY: positionY.value}, {scale: scale.value}],
  }))

  const gesture = Gesture.Simultaneous(pinchGesture, panGesture)

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
    </GestureDetector>
  )
}

export {ZoomableBox}
