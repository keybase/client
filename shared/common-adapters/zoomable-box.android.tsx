import type {Props} from './zoomable-box'
import * as React from 'react'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  useDerivedValue,
  withTiming,
  cancelAnimation,
  runOnJS,
  withDecay,
} from 'react-native-reanimated'
import {View, type LayoutChangeEvent} from 'react-native'
import {Gesture, GestureDetector} from 'react-native-gesture-handler'
import * as Styles from '@/styles'

const needDiff = Styles.dimensionWidth / 3

// mostly based on https://github.com/intergalacticspacehighway/react-native-reanimated-zoom
export function ZoomableBox(props: Props) {
  const {children, minZoom = 1, maxZoom = 10, style, zoomScale} = props
  const {onZoom, contentContainerStyle, onLayout: _onLayout, onSwipe, onTap: _onTap} = props

  const onTap = React.useCallback(() => {
    _onTap?.()
  }, [_onTap])

  const translationX = useSharedValue(0)
  const translationY = useSharedValue(0)
  const velocityX = useSharedValue(0)
  const velocityY = useSharedValue(0)
  const originX = useSharedValue(0)
  const originY = useSharedValue(0)
  const scale = useSharedValue(zoomScale ?? 1)
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
  const panSwipedCounter = useSharedValue(0)
  const panFingers = useSharedValue(0)

  const containerWidth = useSharedValue(0)
  const containerHeight = useSharedValue(0)

  const lastZoomScaleRef = React.useRef<undefined | number>()
  if (lastZoomScaleRef.current !== zoomScale && zoomScale !== undefined) {
    lastZoomScaleRef.current = zoomScale
    scale.value = lastZoomScaleRef.current
  }

  const gesture = React.useMemo(() => {
    const resetZoomState = () => {
      'worklet'
      // reset all state
      translationX.value = 0
      translationY.value = 0
      scale.value = withTiming(zoomScale ?? 1)
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
      .averageTouches(true)
      .onStart(e => {
        if (!isZoomed.value) {
          return
        }
        cancelAnimation(translationX)
        cancelAnimation(translationY)
        cancelAnimation(scale)

        prevTranslationX.value = translationX.value
        prevTranslationY.value = translationY.value
        panFingers.value = e.numberOfPointers
      })
      .onUpdate(e => {
        // if we're done panning ignore us letting go
        if (e.numberOfPointers < panFingers.value) {
          return
        }
        panFingers.value = e.numberOfPointers
        if (!isZoomed.value) {
          panTranslateX.value = e.translationX
          panTranslateY.value = e.translationY
        } else {
          translationX.value = prevTranslationX.value + e.translationX
          translationY.value = prevTranslationY.value + e.translationY
          velocityX.value = e.velocityX
          velocityY.value = e.velocityY
        }
      })
      .onEnd(e => {
        panSwipedCounter.value++
        panFingers.value = 0
        translationX.value = withDecay({deceleration: 0.9, velocity: e.velocityX})
        translationY.value = withDecay({deceleration: 0.9, velocity: e.velocityY})
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
        const newScale = prevScale.value * e.scale
        if (newScale < minZoom || newScale > maxZoom) return

        scale.value = prevScale.value * e.scale

        // maybe this is always true... but not changing this now
        // eslint-disable-next-line
        if (isPinching.value) {
          // translate the image to the focal point as we're zooming
          translationX.value =
            prevTranslationX.value +
            -1 * ((scale.value - offsetScale.value) * (originX.value - viewWidth.value / 2))
          translationY.value =
            prevTranslationY.value +
            -1 * ((scale.value - offsetScale.value) * (originY.value - viewHeight.value / 2))
        }
      })
      .onEnd(() => {
        isPinching.value = false
        prevTranslationX.value = translationX.value
        prevTranslationY.value = translationY.value
        // stop pan
        panFingers.value = 3
        if (zoomScale !== undefined) {
          if (scale.value < zoomScale) {
            resetZoomState()
          }
        }
      })

    const singleTap = Gesture.Tap()
      .maxDuration(250)
      .numberOfTaps(1)
      .onStart(() => {
        runOnJS(onTap)()
      })
    const doubleTap = Gesture.Tap()
      .maxDuration(250)
      .numberOfTaps(2)
      .onStart(e => {
        // if zoomed in or zoomed out, we want to reset
        if (isZoomed.value) {
          resetZoomState()
        } else {
          const zoom = 3
          // translate the image to the focal point and zoom
          scale.value = withTiming(zoom)
          translationX.value = withTiming(-1 * (zoom * (e.x - viewWidth.value / 2)))
          translationY.value = withTiming(-1 * (zoom * (e.y - viewHeight.value / 2)))
        }
      })
    const taps = Gesture.Exclusive(doubleTap, singleTap)

    return Gesture.Race(taps, Gesture.Simultaneous(pan, pinch))
  }, [
    maxZoom,
    minZoom,
    isPinching,
    isZoomed,
    offsetScale,
    onTap,
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
    panSwipedCounter,
    panFingers,
    zoomScale,
    velocityX,
    velocityY,
  ])

  useDerivedValue(() => {
    isZoomed.value = scale.value !== zoomScale
  }, [zoomScale])

  const updateOnZoom = React.useCallback(
    (scale: number, px: number, py: number) => {
      const height = scale * viewHeight.value
      const width = scale * viewWidth.value
      const x = width / 2 - px - containerWidth.value / 2
      const y = height / 2 - py - containerHeight.value / 2
      onZoom?.({
        height,
        scale,
        width,
        x,
        y,
      })
    },
    [onZoom, viewHeight, viewWidth, containerHeight, containerWidth]
  )

  useDerivedValue(() => {
    runOnJS(updateOnZoom)(scale.value, translationX.value, translationY.value)
  }, [updateOnZoom])

  const lastPanSwipedCounter = useSharedValue(0)
  useAnimatedReaction(
    () => ({
      _panSwipedCounter: panSwipedCounter.value,
    }),
    ({_panSwipedCounter}) => {
      if (lastPanSwipedCounter.value === _panSwipedCounter) return
      lastPanSwipedCounter.value = _panSwipedCounter
      if (isZoomed.value || !onSwipe) return
      const tx = panTranslateX.value
      if (tx > needDiff) {
        runOnJS(onSwipe)(false)
      } else if (-tx > needDiff) {
        runOnJS(onSwipe)(true)
      }
    },
    [onSwipe]
  )

  const as = useAnimatedStyle(() => {
    return {
      position: 'absolute',
      transform: [
        // pan
        {translateX: translationX.value},
        {translateY: translationY.value},
        // center again
        {translateX: containerWidth.value / 2 - (viewWidth.value * scale.value) / 2},
        {translateY: containerHeight.value / 2 - (viewHeight.value * scale.value) / 2},
        // Move to center
        {translateX: -viewWidth.value / 2},
        {translateY: -viewHeight.value / 2},
        // Apply scale
        {scale: scale.value},
        // Move back to upper left
        {translateX: viewWidth.value / 2},
        {translateY: viewHeight.value / 2},
      ],
    }
  }, [])

  const onContainerLayout = React.useCallback(
    (e: LayoutChangeEvent) => {
      containerHeight.value = e.nativeEvent.layout.height
      containerWidth.value = e.nativeEvent.layout.width
      _onLayout?.(e)
    },
    [containerHeight, containerWidth, _onLayout]
  )
  const onLayout = React.useCallback(
    (e: LayoutChangeEvent) => {
      viewHeight.value = e.nativeEvent.layout.height
      viewWidth.value = e.nativeEvent.layout.width
    },
    [viewHeight, viewWidth]
  )

  const memoizedStyle = React.useMemo(() => [as, contentContainerStyle], [as, contentContainerStyle])
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
