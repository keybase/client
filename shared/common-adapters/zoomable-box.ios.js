// @flow
import * as React from 'react'
import ScrollView from './scroll-view'
import type {Props} from './zoomable-box'

export const ZoomableBox = (props: Props) => (
  <ScrollView
    children={props.children}
    contentContainerStyle={props.contentContainerStyle}
    style={props.style}
    minimumZoomScale={1}
    maximumZoomScale={props.maxZoom || 3}
    scrollsToTop={false}
    indicatorStyle="white"
    alwaysBounceVertical={false}
  />
)
