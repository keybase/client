import * as React from 'react'
import * as Styles from '../styles'
import ScrollView from './scroll-view'
import type {Props} from './zoomable-box'
import type {GestureResponderEvent} from 'react-native'

const Kb = {
  ScrollView,
}

const needDiff = Styles.dimensionWidth / 3

export const ZoomableBox = (props: Props) => {
  const {onSwipe} = props
  const initialTouch = React.useRef(-1)
  const curScaleRef = React.useRef(1)
  const onTouchStart = React.useCallback((e: GestureResponderEvent) => {
    initialTouch.current = e.nativeEvent.pageX
  }, [])
  const onTouchEnd = React.useCallback(
    (e: GestureResponderEvent) => {
      const scaleDiff = Math.abs(1 - curScaleRef.current)
      if (scaleDiff > 0.1) {
        return
      }
      const diff = e.nativeEvent.pageX - initialTouch.current
      if (diff > needDiff) {
        onSwipe?.(false)
      } else if (diff < needDiff) {
        onSwipe?.(true)
      }
      initialTouch.current = -1
    },
    [onSwipe]
  )

  const [zoomScale, setZoomScale] = React.useState(1)
  React.useEffect(() => {
    setTimeout(() => {
      props.zoomScale && setZoomScale(props.zoomScale)
    }, 1000)
  }, [props.zoomScale])
  return (
    <Kb.ScrollView
      centerContent={true}
      alwaysBounceVertical={false}
      bounces={props.bounces}
      children={props.children}
      contentContainerStyle={props.contentContainerStyle}
      indicatorStyle="white"
      maximumZoomScale={props.maxZoom || 10}
      minimumZoomScale={props.minZoom || 1}
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
      key={String(zoomScale)}
      zoomScale={zoomScale}
      onLayout={props.onLayout}
    />
  )
}
