// @flow
import * as React from 'react'
import ScrollView from './scroll-view'
import type {Props} from './zoomable-box'

export const ZoomableBox = (props: Props) => (
  <ScrollView
    {...props}
    minimumZoomScale={1}
    maximumZoomScale={props.maxZoom || 3}
    scrollsToTop={false}
    indicatorStyle="white"
    alwaysBounceVertical={false}
  />
)
