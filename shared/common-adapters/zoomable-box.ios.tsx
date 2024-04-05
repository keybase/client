import * as React from 'react'
import ScrollView from './scroll-view'
import type {Props} from './zoomable-box'
import {type LayoutChangeEvent, type GestureResponderEvent, useWindowDimensions} from 'react-native'
import {Gesture, GestureDetector} from 'react-native-gesture-handler'
import {runOnJS} from 'react-native-reanimated'

const Kb = {ScrollView}

export const ZoomableBox = (props: Props) => {
  const {onSwipe, onLayout, onTap: _onTap} = props
  const {width: windowWidth} = useWindowDimensions()
  const needDiff = windowWidth / 3
  const onTap = React.useCallback(() => {
    _onTap?.()
  }, [_onTap])
  const initialTouch = React.useRef(-1)
  const curScaleRef = React.useRef(1)
  // max touches during this gesture
  const maxTouchesRef = React.useRef(0)
  const onTouchStart = React.useCallback((e: GestureResponderEvent) => {
    // we get calls when the touches increase
    maxTouchesRef.current = Math.max(maxTouchesRef.current, e.nativeEvent.touches.length)
    if (e.nativeEvent.touches.length === 1) {
      initialTouch.current = e.nativeEvent.pageX
    } else {
      initialTouch.current = -1
    }
  }, [])
  const onTouchEnd = React.useCallback(
    (e: GestureResponderEvent) => {
      const maxTouches = maxTouchesRef.current
      maxTouchesRef.current = 0
      const diff = e.nativeEvent.pageX - initialTouch.current
      initialTouch.current = -1
      // we only do swipes on single touch
      if (maxTouches !== 1) {
        return
      }
      const scaleDiff = Math.abs(1 - curScaleRef.current)
      if (scaleDiff > 0.1) {
        return
      }
      if (diff > needDiff) {
        onSwipe?.(false)
      } else if (diff < -needDiff) {
        onSwipe?.(true)
      }
    },
    [onSwipe, needDiff]
  )

  const widthRef = React.useRef(0)
  const heightRef = React.useRef(0)
  const _onLayout = React.useCallback(
    (e: Partial<LayoutChangeEvent>) => {
      widthRef.current = e.nativeEvent?.layout.width ?? 0
      heightRef.current = e.nativeEvent?.layout.height ?? 0
      onLayout?.(e)
    },
    [onLayout]
  )

  const ref = React.useRef<ScrollView>(null)
  const onDoubleTap = React.useCallback(() => {
    const scroll = ref.current as unknown as null | {
      getScrollResponder?:
        | undefined
        | (() =>
            | undefined
            | {
                scrollResponderZoomTo: (p: {
                  animated: boolean
                  width: number
                  height: number
                  x?: number
                  y?: number
                }) => void
              })
    }
    scroll?.getScrollResponder?.()?.scrollResponderZoomTo(
      curScaleRef.current > 1.01
        ? {
            animated: true,
            height: 2000,
            width: 2000,
          }
        : {
            animated: true,
            height: heightRef.current / 4,
            width: widthRef.current / 4,
            x: widthRef.current / 4,
            y: heightRef.current / 4,
          }
    )
  }, [])

  const singleTap = Gesture.Tap()
    .maxDuration(250)
    .numberOfTaps(1)
    .maxDistance(5)
    .onStart(() => {
      runOnJS(onTap)()
    })
  const doubleTap = Gesture.Tap()
    .maxDuration(250)
    .numberOfTaps(2)
    .maxDistance(5)
    .onStart(() => {
      runOnJS(onDoubleTap)()
    })
  const taps = Gesture.Exclusive(doubleTap, singleTap)

  return (
    <GestureDetector gesture={taps}>
      <Kb.ScrollView
        ref={ref}
        centerContent={true}
        alwaysBounceVertical={false}
        bounces={props.bounces}
        children={props.children}
        contentContainerStyle={props.contentContainerStyle}
        indicatorStyle="white"
        maximumZoomScale={props.maxZoom || 10}
        minimumZoomScale={props.minZoom || 1}
        onLayout={_onLayout}
        onTouchStart={onSwipe ? onTouchStart : undefined}
        onTouchEnd={onSwipe ? onTouchEnd : undefined}
        onScroll={e => {
          curScaleRef.current = e.nativeEvent?.zoomScale ?? 0
          props.onZoom?.({
            height: e.nativeEvent?.contentSize.height ?? 0,
            scale: e.nativeEvent?.zoomScale ?? 0,
            width: e.nativeEvent?.contentSize.width ?? 0,
            x: e.nativeEvent?.contentOffset.x ?? 0,
            y: e.nativeEvent?.contentOffset.y ?? 0,
          })
        }}
        scrollEventThrottle={16}
        scrollsToTop={false}
        showsHorizontalScrollIndicator={props.showsHorizontalScrollIndicator}
        showsVerticalScrollIndicator={props.showsVerticalScrollIndicator}
        style={props.style}
      />
    </GestureDetector>
  )
}
