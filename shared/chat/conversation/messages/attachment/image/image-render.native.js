// @flow
import * as React from 'react'
import WKWebView from 'react-native-wkwebview-reborn'
import {NativeImage, NativeDimensions} from '../../../../../common-adapters/native-wrappers.native'
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
    const arg = !this.playingVideo ? 'play' : 'pause'
    this.webview.evaluateJavaScript(`togglePlay("${arg}")`)
    this.playingVideo = !this.playingVideo
  }

  render() {
    if (this.props.inlineVideoPlayable && this.props.videoSrc.length > 0) {
      const uri = this.props.videoSrc + '&poster=' + encodeURIComponent(this.props.src)
      const source = {uri}
      const allLoads = () => {
        this.props.onLoad()
        this.props.onLoadedVideo()
      }
      return (
        <WKWebView
          ref={ref => {
            this.webview = ref
          }}
          styles={this.props.style}
          onLoadEnd={allLoads}
          source={source}
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
