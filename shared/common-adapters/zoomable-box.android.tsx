import * as React from 'react'
import type {Props} from './zoomable-box'
import {GestureDetector, Gesture} from 'react-native-gesture-handler'
import Animated, {useSharedValue, useAnimatedStyle, runOnJS} from 'react-native-reanimated'
import {View} from 'react-native'

const ZoomableBox = (p: Props) => {
  const {children, style, onZoom} = p
  const scale = useSharedValue(1)
  const savedScale = useSharedValue(1)
  const positionX = useSharedValue(0)
  const savedPositionX = useSharedValue(0)
  const positionY = useSharedValue(0)
  const savedPositionY = useSharedValue(0)
  const contentWidth = useSharedValue(0)
  const contentHeight = useSharedValue(0)
  const containerWidth = useSharedValue(0)
  const containerHeight = useSharedValue(0)

  const updateOnZoom = React.useCallback(
    (scale: number, px: number, py: number) => {
      const height = scale * contentHeight.value
      const width = scale * contentWidth.value
      const x = width / 2 - px - containerWidth.value / 2
      const y = height / 2 - py - containerHeight.value / 2
      onZoom?.({height, width, x, y})
    },
    [onZoom, contentHeight, contentWidth, containerHeight, containerWidth]
  )

  const pinchGesture = Gesture.Pinch()
    .onUpdate(e => {
      scale.value = Math.max(1, savedScale.value * e.scale)
      runOnJS(updateOnZoom)(scale.value, positionX.value, positionY.value)
    })
    .onEnd(() => {
      savedScale.value = scale.value
    })

  const panGesture = Gesture.Pan()
    .onUpdate(e => {
      const height = scale.value * contentHeight.value
      const width = scale.value * contentWidth.value

      const maxW = (width - containerWidth.value) / 2
      let x = savedPositionX.value + e.translationX
      x = Math.min(x, maxW)
      x = Math.max(x, -maxW)
      positionX.value = x

      const maxH = (height - containerHeight.value) / 2
      let y = savedPositionY.value + e.translationY
      y = Math.min(y, maxH)
      y = Math.max(y, -maxH)
      positionY.value = y
      runOnJS(updateOnZoom)(scale.value, positionX.value, positionY.value)
    })
    .onEnd(() => {
      savedPositionX.value = positionX.value
      savedPositionY.value = positionY.value
    })

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{translateX: positionX.value}, {translateY: positionY.value}, {scale: scale.value}],
  }))

  const gesture = Gesture.Simultaneous(pinchGesture, panGesture)

  const onLayout = React.useCallback(
    (e: any) => {
      const {nativeEvent} = e
      const {layout} = nativeEvent
      const {height, width} = layout
      contentWidth.value = width
      contentHeight.value = height
    },
    [contentWidth, contentHeight]
  )

  const onLayoutContainer = React.useCallback(
    (e: any) => {
      const {nativeEvent} = e
      const {layout} = nativeEvent
      const {height, width} = layout
      containerWidth.value = width
      containerHeight.value = height
    },
    [containerWidth, containerHeight]
  )

  return (
    <GestureDetector gesture={gesture}>
      <View style={style} onLayout={onLayoutContainer}>
        <Animated.View style={animatedStyle} onLayout={onLayout}>
          {children}
        </Animated.View>
      </View>
    </GestureDetector>
  )
}

export {ZoomableBox}
