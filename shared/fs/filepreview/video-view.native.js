// @flow
import * as React from 'react'
import {globalColors} from '../../styles'
import WebView from '../../common-adapters/web-view.native'
import {type VideoViewProps} from './video-view'

// NOTE that we are not detecting invalid token for VideoView at the moment.
// See image-view.desktop.js for more details.

const VideoView = ({url, onInvalidToken}: VideoViewProps) => (
  <WebView style={stylesVideoView} source={{uri: url}} />
)

const stylesVideoView = {
  backgroundColor: globalColors.blue5,
}

export default VideoView
