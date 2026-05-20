import * as React from 'react'
import {StyleSheet, View, type LayoutChangeEvent} from 'react-native'
import Animated, {useAnimatedStyle, useDerivedValue, useSharedValue} from 'react-native-reanimated'
import {Gesture, GestureDetector} from 'react-native-gesture-handler'

import {useVector} from './commons/hooks/useVector'
import {useSizeVector} from './commons/hooks/useSizeVector'
import {usePanCommons} from './commons/hooks/usePanCommons'
import {usePinchCommons} from './commons/hooks/usePinchCommons'
import {useDoubleTapCommons} from './commons/hooks/useDoubleTapCommons'

import type {BoundsFuction, CommonZoomState, SwipeDirection, TapGestureEvent} from './types'

type ResumableZoomProps = {
  children: React.ReactNode
  style?: object
  extendGestures?: boolean
  maxScale?: number
  panMode?: 'clamp' | 'free' | 'friction'
  onTap?: (e: TapGestureEvent) => void
  onUpdate?: (state: CommonZoomState<number>) => void
  onSwipe?: (direction: SwipeDirection) => void
}

const ResumableZoom = ({
  children,
  style,
  extendGestures = false,
  maxScale: userMaxScale = 6,
  panMode = 'clamp',
  onTap,
  onUpdate,
  onSwipe,
}: ResumableZoomProps) => {
  if (userMaxScale < 1) {
    throw new Error('ResumableZoom: maxScale must be >= 1')
  }

  const minScale = 1
  const decay = true
  const scaleMode = 'bounce' as const
  const pinchMode = 'clamp' as const
  const allowPinchPanning = true

  const rootSize = useSizeVector(1, 1)
  const childSize = useSizeVector(1, 1)
  const extendedSize = useSizeVector(1, 1)

  const translate = useVector(0, 0)
  const offset = useVector(0, 0)
  const scale = useSharedValue<number>(minScale)
  const scaleOffset = useSharedValue<number>(minScale)

  const maxScale = useSharedValue(userMaxScale)
  React.useEffect(() => {
    maxScale.value = userMaxScale
  }, [maxScale, userMaxScale])

  useDerivedValue(() => {
    extendedSize.width.value = extendGestures
      ? Math.max(rootSize.width.value, childSize.width.value)
      : childSize.width.value

    extendedSize.height.value = extendGestures
      ? Math.max(rootSize.height.value, childSize.height.value)
      : childSize.height.value
  }, [extendGestures, rootSize, childSize])

  const boundsFn: BoundsFuction = (optionalScale) => {
    'worklet'
    const actualScale = optionalScale ?? scale.value
    const boundX = Math.max(0, childSize.width.value * actualScale - rootSize.width.value) / 2
    const boundY = Math.max(0, childSize.height.value * actualScale - rootSize.height.value) / 2
    return {x: boundX, y: boundY}
  }

  useDerivedValue(() => {
    onUpdate?.({
      containerSize: {
        width: rootSize.width.value,
        height: rootSize.height.value,
      },
      childSize: {
        width: childSize.width.value,
        height: childSize.height.value,
      },
      maxScale: maxScale.value,
      translateX: translate.x.value,
      translateY: translate.y.value,
      scale: scale.value,
    })
  }, [rootSize, childSize, translate, maxScale, scale])

  const {gesturesEnabled, onTouchesDown, onTouchesMove, onTouchesUp, onPinchStart, onPinchUpdate, onPinchEnd} =
    usePinchCommons({
      container: extendedSize,
      translate,
      offset,
      scale,
      scaleOffset,
      minScale,
      maxScale,
      allowPinchPanning,
      scaleMode,
      pinchMode,
      boundFn: boundsFn,
      userCallbacks: {},
    })

  const {onPanStart, onPanChange, onPanEnd} = usePanCommons({
    container: extendedSize,
    translate,
    offset,
    panMode,
    boundFn: boundsFn,
    decay,
    userCallbacks: {onSwipe},
  })

  const {onDoubleTapStart, onDoubleTapEnd, enablePanGestureByDoubleTap} = useDoubleTapCommons({
    container: extendedSize,
    translate,
    scale,
    minScale,
    maxScale,
    scaleOffset,
    boundsFn: boundsFn,
  })

  const pinch = Gesture.Pinch()
    .manualActivation(true)
    .onTouchesDown(onTouchesDown)
    .onTouchesMove(onTouchesMove)
    .onTouchesUp(onTouchesUp)
    .onStart(onPinchStart)
    .onUpdate(onPinchUpdate)
    .onEnd(onPinchEnd)

  const pan = Gesture.Pan()
    .enabled(gesturesEnabled && enablePanGestureByDoubleTap)
    .maxPointers(1)
    .onStart(onPanStart)
    .onChange(onPanChange)
    .onEnd(onPanEnd)

  const tap = Gesture.Tap()
    .enabled(gesturesEnabled)
    .maxDuration(250)
    .numberOfTaps(1)
    .runOnJS(true)
    .onEnd((e) => onTap?.(e))

  const doubleTap = Gesture.Tap()
    .enabled(gesturesEnabled)
    .maxDuration(250)
    .numberOfTaps(2)
    .onStart(onDoubleTapStart)
    .onEnd(onDoubleTapEnd)

  const measureRoot = (e: LayoutChangeEvent) => {
    rootSize.width.value = e.nativeEvent.layout.width
    rootSize.height.value = e.nativeEvent.layout.height
  }

  const measureChild = (e: LayoutChangeEvent) => {
    childSize.width.value = e.nativeEvent.layout.width
    childSize.height.value = e.nativeEvent.layout.height
  }

  const detectorStyle = useAnimatedStyle(() => {
    return {
      width: extendedSize.width.value,
      height: extendedSize.height.value,
      transform: [{translateX: translate.x.value}, {translateY: translate.y.value}, {scale: scale.value}],
    }
  }, [extendedSize, translate, scale])

  const composedGesture = Gesture.Race(pinch, pan, Gesture.Exclusive(doubleTap, tap))

  return (
    <View style={[style ?? styles.flex, styles.center]} onLayout={measureRoot}>
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={[detectorStyle, styles.center]}>
          <Animated.View onLayout={measureChild}>{children}</Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  )
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
  },
})

export default ResumableZoom
