// @flow
import * as React from 'react'
import ScrollView from './scroll-view'
import type {Props} from './zoomable-box'

export const ZoomableBox = (props: Props) => (
  <ScrollView
    alwaysBounceVertical={false}
    bounces={props.bounces}
    children={props.children}
    contentContainerStyle={props.contentContainerStyle}
    indicatorStyle="white"
    maximumZoomScale={props.maxZoom || 3}
    minimumZoomScale={props.minZoom || 1}
    onScroll={e =>
      props.onZoom &&
      props.onZoom({
        height: e.nativeEvent.contentSize.height,
        width: e.nativeEvent.contentSize.width,
        x: e.nativeEvent.contentOffset.x,
        y: e.nativeEvent.contentOffset.y,
      })
    }
    scrollEventThrottle={16}
    scrollsToTop={false}
    showsHorizontalScrollIndicator={props.showsHorizontalScrollIndicator}
    showsVerticalScrollIndicator={props.showsVerticalScrollIndicator}
    style={props.style}
  />
)
