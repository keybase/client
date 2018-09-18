// @flow
import * as React from 'react'
import {
  NativeImage,
  NativeDimensions,
  NativeWebView,
} from '../../../../../common-adapters/native-wrappers.native'
import type {Props} from './image-render.types'

export class ImageRender extends React.Component<Props> {
  webview: any
  playingVideo: boolean

  constructor(props: Props) {
    super(props)
    this.playingVideo = false
  }

  onVideoClick = () => {
    if (!this.webview) {
      return
    }
    const arg = this.playingVideo ? 'pause' : 'play'
    const runJS = this.webview.injectJavaScript
    runJS(`togglePlay("${arg}")`)
    this.playingVideo = !this.playingVideo
  }

  _allLoads = () => {
    this.props.onLoad()
    this.props.onLoadedVideo()
  }

  render() {
    if (this.props.inlineVideoPlayable && this.props.videoSrc.length > 0) {
      const source = {
        uri: `${this.props.videoSrc}&poster=${encodeURIComponent(this.props.src)}`,
      }
      return (
        <NativeWebView
          allowsInlineMediaPlayback={true}
          useWebKit={true}
          ref={ref => {
            this.webview = ref
          }}
          source={source}
          style={this.props.style}
          onLoadEnd={this._allLoads}
          scrollEnabled={false}
        />
      )
    }
    return (
      <NativeImage
        onLoad={this.props.onLoad}
        source={{uri: this.props.src}}
        style={this.props.style}
        resizeMode="contain"
      />
    )
  }
}

export function imgMaxWidth() {
  const {width: maxWidth} = NativeDimensions.get('window')
  return Math.min(320, maxWidth - 60)
}
