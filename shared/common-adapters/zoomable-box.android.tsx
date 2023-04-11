import type {Props} from './zoomable-box'
import React, {useCallback, useMemo} from 'react'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
  withSpring,
  cancelAnimation,
  runOnJS,
} from 'react-native-reanimated'
import {View} from 'react-native'
import {Gesture, GestureDetector} from 'react-native-gesture-handler'
import * as Styles from '../styles'

// mostly based on https://github.com/intergalacticspacehighway/react-native-reanimated-zoom
export function ZoomableBox(props: Props) {
  const {children, minZoom = 1, maxZoom = 3, style, onZoom, contentContainerStyle} = props

  const translationX = useSharedValue(0)
  const translationY = useSharedValue(0)
  const originX = useSharedValue(0)
  const originY = useSharedValue(0)
  const scale = useSharedValue(1)
  const isPinching = useSharedValue(false)
  const isZoomed = useSharedValue(false)
  const viewHeight = useSharedValue(0)
  const viewWidth = useSharedValue(0)

  const prevScale = useSharedValue(0)
  const offsetScale = useSharedValue(0)
  const prevTranslationX = useSharedValue(0)
  const prevTranslationY = useSharedValue(0)

  const panTranslateX = useSharedValue(0)
  const panTranslateY = useSharedValue(0)

  const containerWidth = useSharedValue(0)
  const containerHeight = useSharedValue(0)

  const gesture = useMemo(() => {
    const resetZoomState = () => {
      'worklet'
      // reset all state
      translationX.value = withTiming(0)
      translationY.value = withTiming(0)
      scale.value = withTiming(1)
      originX.value = 0
      originY.value = 0
      isPinching.value = false
      prevScale.value = 0
      prevTranslationX.value = 0
      prevTranslationY.value = 0
      panTranslateX.value = 0
      panTranslateY.value = 0
    }

    // we only activate pan handler when the image is zoomed or user is not pinching
    const pan = Gesture.Pan()
      .onStart(() => {
        if (isPinching.value || !isZoomed.value) return

        cancelAnimation(translationX)
        cancelAnimation(translationY)
        cancelAnimation(scale)

        prevTranslationX.value = translationX.value
        prevTranslationY.value = translationY.value
      })
      .onUpdate(e => {
        if (isPinching.value || !isZoomed.value) {
          panTranslateX.value = e.translationX
          panTranslateY.value = e.translationY
        } else {
          // imagine what happens to pixels when we zoom in. (they get multiplied by x times scale)
          const maxTranslateX = (viewWidth.value / 2) * scale.value - viewWidth.value / 2
          const minTranslateX = -maxTranslateX

          const maxTranslateY = (viewHeight.value / 2) * scale.value - viewHeight.value / 2
          const minTranslateY = -maxTranslateY

          const nextTranslateX = prevTranslationX.value + e.translationX - panTranslateX.value
          const nextTranslateY = prevTranslationY.value + e.translationY - panTranslateY.value

          if (nextTranslateX > maxTranslateX) {
            translationX.value = maxTranslateX
          } else if (nextTranslateX < minTranslateX) {
            translationX.value = minTranslateX
          } else {
            translationX.value = nextTranslateX
          }

          if (nextTranslateY > maxTranslateY) {
            translationY.value = maxTranslateY
          } else if (nextTranslateY < minTranslateY) {
            translationY.value = minTranslateY
          } else {
            translationY.value = nextTranslateY
          }
        }
      })
      .onEnd(() => {
        if (isPinching.value || !isZoomed.value) return

        panTranslateX.value = 0
        panTranslateY.value = 0
      })

    const pinch = Gesture.Pinch()
      .onStart(() => {
        cancelAnimation(translationX)
        cancelAnimation(translationY)
        cancelAnimation(scale)
        prevScale.value = scale.value
        offsetScale.value = scale.value
      })
      .onUpdate(e => {
        // when pointer is 1 we don't want to translate origin
        if (e.numberOfPointers === 1 && isPinching.value) {
          prevTranslationX.value = translationX.value
          prevTranslationY.value = translationY.value
          isPinching.value = false
        } else if (e.numberOfPointers === 2) {
          const newScale = prevScale.value * e.scale

          if (newScale < minZoom || newScale > maxZoom) return

          scale.value = prevScale.value * e.scale

          // reset the origin
          if (!isPinching.value) {
            isPinching.value = true
            originX.value = e.focalX
            originY.value = e.focalY
            prevTranslationX.value = translationX.value
            prevTranslationY.value = translationY.value
            offsetScale.value = scale.value
          }

          if (isPinching.value) {
            // translate the image to the focal point as we're zooming
            translationX.value =
              prevTranslationX.value +
              -1 * ((scale.value - offsetScale.value) * (originX.value - viewWidth.value / 2))
            translationY.value =
              prevTranslationY.value +
              -1 * ((scale.value - offsetScale.value) * (originY.value - viewHeight.value / 2))
          }
        }
      })
      .onEnd(() => {
        isPinching.value = false
        prevTranslationX.value = translationX.value
        prevTranslationY.value = translationY.value

        if (scale.value < 1.1) {
          resetZoomState()
        }
      })

    const doubleTap = Gesture.Tap()
      .onStart(e => {
        // if zoomed in or zoomed out, we want to reset
        if (scale.value !== 1) {
          resetZoomState()
        } else {
          const zoom = 3
          // translate the image to the focal point and zoom
          scale.value = withTiming(zoom)
          translationX.value = withTiming(-1 * (zoom * (e.x - viewWidth.value / 2)))
          translationY.value = withTiming(-1 * (zoom * (e.y - viewHeight.value / 2)))
        }
      })
      .numberOfTaps(2)

    return Gesture.Race(doubleTap, Gesture.Simultaneous(pan, pinch))
  }, [
    maxZoom,
    minZoom,
    isPinching,
    isZoomed,
    offsetScale,
    originX,
    originY,
    viewHeight,
    viewWidth,
    prevScale,
    prevTranslationX,
    prevTranslationY,
    panTranslateX,
    panTranslateY,
    scale,
    translationX,
    translationY,
  ])

  useDerivedValue(() => {
    if (scale.value > 1 && !isZoomed.value) {
      isZoomed.value = true
    } else if (scale.value === 1 && isZoomed.value) {
      isZoomed.value = false
    }
  }, [])

  const updateOnZoom = React.useCallback(
    (scale: number, px: number, py: number) => {
      const height = scale * viewHeight.value
      const width = scale * viewWidth.value
      const x = width / 2 - px - containerWidth.value / 2
      const y = height / 2 - py - containerHeight.value / 2
      onZoom?.({height, width, x, y})
    },
    [onZoom, viewHeight, viewWidth, containerHeight, containerWidth]
  )

  useDerivedValue(() => {
    runOnJS(updateOnZoom)(scale.value, translationX.value, translationY.value)
  }, [])

  const as = useAnimatedStyle(() => {
    return {
      transform: [
        {translateX: withSpring(translationX.value, {damping: 2000, stiffness: 1000})},
        {translateY: withSpring(translationY.value, {damping: 2000, stiffness: 1000})},
        {scale: scale.value},
      ],
    }
  }, [])

  const onContainerLayout = useCallback(
    e => {
      containerHeight.value = e.nativeEvent.layout.height
      containerWidth.value = e.nativeEvent.layout.width
    },
    [containerHeight, containerWidth]
  )
  const onLayout = useCallback(
    e => {
      viewHeight.value = e.nativeEvent.layout.height
      viewWidth.value = e.nativeEvent.layout.width
    },
    [viewHeight, viewWidth]
  )

  const memoizedStyle = useMemo(() => [as, contentContainerStyle], [as, contentContainerStyle])

  return (
    <GestureDetector gesture={gesture}>
      <View style={[style, styles.container]} onLayout={onContainerLayout}>
        <Animated.View onLayout={onLayout} style={memoizedStyle}>
          {children}
        </Animated.View>
      </View>
    </GestureDetector>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  container: {overflow: 'hidden'},
}))
