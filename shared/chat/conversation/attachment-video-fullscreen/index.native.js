// @flow
import React from 'react'
import {WebView} from '../../../common-adapters'
import {globalColors} from '../../../styles'
import {FloatingMenuParentHOC, type FloatingMenuParentProps} from '../../../common-adapters/floating-menu'
import type {Props} from './index.types'

class _VideoFullscreen extends React.Component<Props & FloatingMenuParentProps> {
  render() {
    return <WebView style={stylesAVView} url={this.props.path} />
  }
}

const stylesAVView = {
  backgroundColor: globalColors.blue5,
}
const VideoFullscreen = FloatingMenuParentHOC(_VideoFullscreen)

export default VideoFullscreen
