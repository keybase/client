// @flow
import React from 'react'
import {WebView} from '../../../common-adapters'
import {globalColors} from '../../../styles'
import type {Props} from './index.types'

// Unused for now, we don't view videos in the app on desktop
class VideoFullscreen extends React.Component<Props> {
  render() {
    return <WebView style={stylesAVView} url={this.props.path} />
  }
}

const stylesAVView = {
  backgroundColor: globalColors.blue5,
}

export default VideoFullscreen
