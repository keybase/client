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
      // console.log('aaa reset state<<<<<<<<<<<<<', {zoomScale})
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
        // console.log('aaaa start pan')
        if (!isZoomed.value) {
          // console.log('aaaa pan bail')
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
          // console.log('aaaa panning bail fingers', e.numberOfPointers, panFingers.value)
          return
        }
        panFingers.value = e.numberOfPointers
        console.log('aaaa panning ', {isZoomed: isZoomed.value})
        if (!isZoomed.value) {
          console.log('aaaa panning bail')
          panTranslateX.value = e.translationX
          panTranslateY.value = e.translationY
        } else {
          console.log('aaaa panning', e.translationX, e.translationY)
          translationX.value = prevTranslationX.value + e.translationX
          translationY.value = prevTranslationY.value + e.translationY
          velocityX.value = e.velocityX
          velocityY.value = e.velocityY
          // imagine what happens to pixels when we zoom in. (they get multiplied by x times scale)
          // const maxTranslateX = (viewWidth.value / 2) * scale.value - viewWidth.value / 2
          // const minTranslateX = -maxTranslateX
          //
          // const maxTranslateY = (viewHeight.value / 2) * scale.value - viewHeight.value / 2
          // const minTranslateY = -maxTranslateY
          //
          // const nextTranslateX = prevTranslationX.value + e.translationX - panTranslateX.value
          // const nextTranslateY = prevTranslationY.value + e.translationY - panTranslateY.value
          //
          // if (nextTranslateX > maxTranslateX) {
          //   translationX.value = maxTranslateX
          // } else if (nextTranslateX < minTranslateX) {
          //   translationX.value = minTranslateX
          // } else {
          //   translationX.value = nextTranslateX
          // }
          //
          // if (nextTranslateY > maxTranslateY) {
          //   translationY.value = maxTranslateY
          // } else if (nextTranslateY < minTranslateY) {
          //   translationY.value = minTranslateY
          // } else {
          //   translationY.value = nextTranslateY
          // }
        }
      })
      .onEnd(e => {
        panSwipedCounter.value++
        panFingers.value = 0
        // console.log('aaaa <<<<<<<<<<< wipe pantranslate', panTranslateX.value)
        // panTranslateX.value = 0
        // panTranslateY.value = 0
        // console.log('aaa4a onpanend', e.velocityX, e.velocityY)
        translationX.value = withDecay({velocity: e.velocityX, deceleration: 0.9})
        translationY.value = withDecay({velocity: e.velocityY, deceleration: 0.9})
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
        // console.log('aaaa pinch 2')
        // console.log('aaaa pinch good')
        const newScale = prevScale.value * e.scale

        if (newScale < minZoom || newScale > maxZoom) return

        scale.value = prevScale.value * e.scale

        // reset the origin
        // if (!isPinching.value) {
        //   isPinching.value = true
        //   originX.value = e.focalX
        //   originY.value = e.focalY
        //   prevTranslationX.value = translationX.value
        //   prevTranslationY.value = translationY.value
        //   offsetScale.value = scale.value
        // }

        // maybe this is always true... but not changing this now
        // eslint-disable-next-line
        if (isPinching.value) {
          // translate the image to the focal point as we're zooming
          console.log('aaaa pinch change')
          translationX.value =
            prevTranslationX.value +
            -1 * ((scale.value - offsetScale.value) * (originX.value - viewWidth.value / 2))
          translationY.value =
            prevTranslationY.value +
            -1 * ((scale.value - offsetScale.value) * (originY.value - viewHeight.value / 2))
        }
      })
      .onEnd(() => {
        console.log('aaaa pinch end')
        isPinching.value = false
        prevTranslationX.value = translationX.value
        prevTranslationY.value = translationY.value
        // stop pan
        panFingers.value = 3
        // if (scale.value < 1.1) {
        //   resetZoomState()
        // }
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
        console.log('aaaaa single')
        runOnJS(onTap)()
      })
    const doubleTap = Gesture.Tap()
      .maxDuration(250)
      .numberOfTaps(2)
      .onStart(e => {
        console.log('aaaaa doubletap>>>>>>>>>>>>>>>>>>>>>>>>>>>>', isZoomed.value)
        // if zoomed in or zoomed out, we want to reset
        if (isZoomed.value) {
          resetZoomState()
        } else {
          // isZoomed.value = true
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
        raw: {
          viewWidth: viewWidth.value,
          containerWidth: containerWidth.value,
          px,
          py,
        },
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
      console.log('aaaa pan swipe <<<<<<<<<<<<<<<', isZoomed.value, tx, needDiff)
      if (tx > needDiff) {
        runOnJS(onSwipe)(false)
      } else if (-tx > needDiff) {
        runOnJS(onSwipe)(true)
      }
    },
    [onSwipe]
  )

  const as = useAnimatedStyle(() => {
    // console.log('aaaa useanimatedstyle', {
    //   translationX: translationX.value,
    //   translationY: translationY.value,
    //   scale: scale.value,
    // })
    //
    // console.log('aaa <<<<<<<<<<<<<<<<<', {
    //   containerHeight: containerHeight.value,
    //   viewHeight: viewHeight.value,
    // })
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
      // console.log('aaaa onContainerLayout', e.nativeEvent.layout)
      _onLayout?.(e)
    },
    [containerHeight, containerWidth, _onLayout]
  )
  const onLayout = React.useCallback(
    (e: LayoutChangeEvent) => {
      viewHeight.value = e.nativeEvent.layout.height
      viewWidth.value = e.nativeEvent.layout.width
      // console.log('aaaa androidonlayout', e.nativeEvent.layout)
    },
    [viewHeight, viewWidth]
  )

  const memoizedStyle = React.useMemo(() => [as, contentContainerStyle], [as, contentContainerStyle])

  // const tempas = useAnimatedStyle(() => {
  //   return {
  //     position: 'absolute',
  //     top: containerHeight.value / 2,
  //     left: 0,
  //     right: 0,
  //     backgroundColor: 'red',
  //     height: 2,
  //   }
  // }, [])
  // const tempas2 = useAnimatedStyle(() => {
  //   return {
  //     position: 'absolute',
  //     left: containerWidth.value / 2,
  //     top: 0,
  //     bottom: 0,
  //     backgroundColor: 'red',
  //     width: 2,
  //   }
  // }, [])
  //         <Animated.View style={tempas} />
  // <Animated.View style={tempas2} />

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
