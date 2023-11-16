import * as React from 'react'
import * as Styles from '../styles'
import ScrollView from './scroll-view'
import type {Props} from './zoomable-box'

const Kb = {
  ScrollView,
}

// function useSwipe(onSwipe: (left: boolean) => void) {
//     let firstTouch = 0
//
//     // set user touch start position
//     function onTouchStart(e: any) {
//         firstTouch = e.nativeEvent.pageX
//     }
//
//     // when touch ends check for swipe directions
//     function onTouchEnd(e: any){
//
//         // get touch position and screen size
//         const positionX = e.nativeEvent.pageX
//         const range = windowWidth / rangeOffset
//
//         // check if position is growing positively and has reached specified range
//         if(positionX - firstTouch > range){
//             onSwipeRight && onSwipeRight()
//         }
//         // check if position is growing negatively and has reached specified range
//         else if(firstTouch - positionX > range){
//             onSwipeLeft && onSwipeLeft()
//         }
//     }
//
//     return {onTouchStart, onTouchEnd};
// }

const needDiff = Styles.dimensionWidth / 2

export const ZoomableBox = (props: Props) => {
  const {onSwipe} = props
  const initialTouch = React.useRef(-1)
  const curScaleRef = React.useRef(1)
  // const propsScaleRef = React.useRef(props.zoomScale ?? 0)
  // propsScaleRef.current = props.zoomScale ?? 0
  const onTouchStart = React.useCallback((e: any) => {
    initialTouch.current = e.nativeEvent.pageX
  }, [])
  const onTouchEnd = React.useCallback(
    (e: any) => {
      const scaleDiff = Math.abs(1 - curScaleRef.current)
      console.log('aaaa scalediff', scaleDiff)
      if (scaleDiff > 0.1) {
        console.log('aaaa bail on scaled')
        return
      }
      const diff = e.nativeEvent.pageX - initialTouch.current
      console.log('aaaa diff', diff, curScaleRef.current)
      if (diff > needDiff) {
        console.log('aaaa SWIPE RIGHT')
        onSwipe?.(false)
      } else if (diff < needDiff) {
        console.log('aaaa SWIPE LEFT')
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
  console.log('aaa', zoomScale)
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
        console.log('aaaa onscroll', e.nativeEvent)
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
