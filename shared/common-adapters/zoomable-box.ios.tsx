import * as React from 'react'
import ScrollView from './scroll-view'
import type {Props} from './zoomable-box'
import {type LayoutChangeEvent, type GestureResponderEvent, useWindowDimensions} from 'react-native'
import {Gesture, GestureDetector} from 'react-native-gesture-handler'
import {runOnJS} from 'react-native-reanimated'

const Kb = {ScrollView}

export const ZoomableBox = (props: Props) => {
  const {onSwipe, onLayout, onTap: _onTap, zoomScale, contentSize, children, contentContainerStyle} = props
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
      const scaleDiff = Math.abs((zoomScale ?? 1) - curScaleRef.current)
      if (scaleDiff > 0.1) {
        return
      }
      if (diff > needDiff) {
        onSwipe?.(false)
      } else if (diff < -needDiff) {
        onSwipe?.(true)
      }
    },
    [onSwipe, needDiff, zoomScale]
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

  const getScroll = React.useCallback(() => {
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
    return scroll
  }, [])

  const onResetZoom = React.useCallback(() => {
    if (!contentSize) return
    const scroll = getScroll()
    scroll?.getScrollResponder?.()?.scrollResponderZoomTo({
      animated: true,
      height: contentSize.height,
      width: contentSize.width,
      x: 0,
      y: 0,
    })
  }, [contentSize, getScroll])

  const onDoubleTap = React.useCallback(() => {
    const zoomOut = curScaleRef.current > (zoomScale ?? 1)
    if (zoomOut) {
      onResetZoom()
    } else {
      const scroll = getScroll()
      scroll?.getScrollResponder?.()?.scrollResponderZoomTo({
        animated: true,
        height: (contentSize?.height ?? 100) / 4,
        width: (contentSize?.width ?? 100) / 4,
        // not correct
        x: ((contentSize?.width ?? 100) - widthRef.current) / 2,
        y: ((contentSize?.height ?? 100) - heightRef.current) / 2,
      })
    }
  }, [contentSize, zoomScale, onResetZoom, getScroll])

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

  // this is nasty but i need a way to force this component to render correctly. Passing new zoomScale
  // won't necessarily cause it to adopt it
  const old = zoomScale ?? 1
  const fixedZoomScale = old === 1 ? old : old + Math.random() * 0.0001

  return (
    <GestureDetector gesture={taps}>
      <Kb.ScrollView
        ref={ref}
        centerContent={true}
        alwaysBounceVertical={false}
        bounces={props.bounces}
        children={children}
        contentContainerStyle={contentContainerStyle}
        indicatorStyle="white"
        maximumZoomScale={props.maxZoom || 10}
        minimumZoomScale={props.minZoom || 1}
        onLayout={_onLayout}
        onTouchStart={onSwipe ? onTouchStart : undefined}
        onTouchEnd={onSwipe ? onTouchEnd : undefined}
        onScroll={e => {
          curScaleRef.current = e.nativeEvent?.zoomScale ?? 0
          const val = {
            height: e.nativeEvent?.contentSize.height ?? 0,
            scale: e.nativeEvent?.zoomScale ?? 0,
            width: e.nativeEvent?.contentSize.width ?? 0,
            x: e.nativeEvent?.contentOffset.x ?? 0,
            y: e.nativeEvent?.contentOffset.y ?? 0,
          }
          props.onZoom?.(val)
        }}
        scrollEventThrottle={16}
        scrollsToTop={false}
        showsHorizontalScrollIndicator={props.showsHorizontalScrollIndicator}
        showsVerticalScrollIndicator={props.showsVerticalScrollIndicator}
        style={props.style}
        zoomScale={fixedZoomScale}
      />
    </GestureDetector>
  )
}
