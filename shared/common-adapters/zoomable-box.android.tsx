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
  const contentWidthRef = React.useRef(0)
  const contentHeightRef = React.useRef(0)
  const containerWidthRef = React.useRef(0)
  const containerHeightRef = React.useRef(0)

  const updateOnZoom = React.useCallback(
    (scale: number, px: number, py: number) => {
      const height = scale * contentHeightRef.current
      const width = scale * contentWidthRef.current
      const x = width / 2 - px - containerWidthRef.current / 2
      const y = height / 2 - py - containerHeightRef.current / 2
      console.log('aaa updateonzoom', {height, width, x, y, cw: containerWidthRef.current})
      onZoom?.({height, width, x, y})
    },
    [onZoom]
  )

  const pinchGesture = Gesture.Pinch()
    .onUpdate(e => {
      scale.value = savedScale.value * e.scale
      runOnJS(updateOnZoom)(scale.value, positionX.value, positionY.value)
    })
    .onEnd(() => {
      savedScale.value = scale.value
    })

  const panGesture = Gesture.Pan()
    .onUpdate(e => {
      positionX.value = Math.max(0, savedPositionX.value + e.translationX)
      positionY.value = Math.max(0, savedPositionY.value + e.translationY)
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

  const onLayout = React.useCallback((e: any) => {
    const {nativeEvent} = e
    const {layout} = nativeEvent
    const {height, width} = layout
    contentWidthRef.current = width
    contentHeightRef.current = height
  }, [])

  const onLayoutContainer = React.useCallback((e: any) => {
    const {nativeEvent} = e
    const {layout} = nativeEvent
    const {height, width} = layout
    containerWidthRef.current = width
    containerHeightRef.current = height
  }, [])

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
