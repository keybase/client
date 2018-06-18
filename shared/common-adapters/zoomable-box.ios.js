// @flow
import * as React from 'react'
import ScrollView from './scroll-view'
import type {Props} from './zoomable-box'

type State = {
  height: number,
  offsetX: number,
  offsetY: number,
  width: number,
}

class ZoomableBox extends React.Component<Props, State> {
  state = {
    height: 0,
    offsetX: 0,
    offsetY: 0,
    width: 0,
  }

  onScroll = (e: Object) => {
    this.setState({
      height: e.nativeEvent.contentSize.height,
      offsetX: e.nativeEvent.contentOffset.x,
      offsetY: e.nativeEvent.contentOffset.y,
      width: e.nativeEvent.contentSize.width,
    })
  }

  render() {
    return (
      <ScrollView
        alwaysBounceVertical={false}
        children={this.props.children}
        contentContainerStyle={this.props.contentContainerStyle}
        indicatorStyle="white"
        maximumZoomScale={this.props.maxZoom || 3}
        minimumZoomScale={1}
        onScroll={this.onScroll}
        scrollEventThrottle={16}
        scrollsToTop={false}
        style={this.props.style}
      />
    )
  }
}

export {ZoomableBox}
