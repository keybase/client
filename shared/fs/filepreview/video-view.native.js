// @flow
import * as React from 'react'
import * as Constants from '../../constants/fs'
import {globalColors} from '../../styles'
import WebView from '../../common-adapters/web-view.native'
import {type VideoViewProps} from './video-view'

const webviewJS = `window.postMessage({title: document.title})`

const getOnMessage = onInvalidToken => e =>
  e.nativeEvent.data.title === Constants.invalidTokenTitle && onInvalidToken()

const VideoView = ({url, onInvalidToken}: VideoViewProps) => (
  <WebView
    styles={stylesVideoView}
    source={{uri: url}}
    injectedJavaScript={webviewJS}
    onMessage={getOnMessage(onInvalidToken)}
  />
)

const stylesVideoView = {
  backgroundColor: globalColors.blue5,
}

export default VideoView
