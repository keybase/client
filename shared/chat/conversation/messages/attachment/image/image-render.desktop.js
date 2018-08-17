// @flow
import * as React from 'react'
import type {Props} from './image-render.types'
import {collapseStyles} from '../../../../../styles'

export class ImageRender extends React.Component<Props> {
  videoRef: any
  playingVideo: boolean

  constructor(props: Props) {
    super(props)
    this.videoRef = React.createRef()
    this.playingVideo = false
  }

  onVideoClick = () => {
    if (!(this.videoRef && this.videoRef.current)) {
      return
    }
    if (!this.playingVideo) {
      this.videoRef.current.play()
    } else {
      this.videoRef.current.pause()
      this.videoRef.current.removeAttribute('controls')
    }
    this.playingVideo = !this.playingVideo
  }

  onVideoMouseEnter = () => {
    if (this.playingVideo && this.videoRef && this.videoRef.current) {
      this.videoRef.current.setAttribute('controls', 'controls')
    }
  }

  onVideoMouseLeave = () => {
    if (this.playingVideo && this.videoRef && this.videoRef.current) {
      this.videoRef.current.removeAttribute('controls')
    }
  }

  render() {
    return this.props.inlineVideoPlayable ? (
      <video
        ref={this.videoRef}
        poster={this.props.src}
        preload="none"
        onLoadStart={this.props.onLoad}
        onLoadedMetadata={this.props.onLoadedVideo}
        controlsList="nodownload nofullscreen noremoteplayback"
        style={collapseStyles([this.props.style, !this.props.loaded && {display: 'none'}])}
      >
        <source src={this.props.videoSrc} />
        <style>{hidePlayButton}</style>
      </video>
    ) : (
      <img
        onLoad={this.props.onLoad}
        draggable="false"
        src={this.props.src}
        style={collapseStyles([this.props.style, !this.props.loaded && {display: 'none'}])}
      />
    )
  }
}

export function imgMaxWidth() {
  return 320
}

const hidePlayButton = `
video::-webkit-media-controls-play-button {
  display: none;
}
`
