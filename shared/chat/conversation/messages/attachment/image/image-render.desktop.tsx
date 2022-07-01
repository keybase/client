import * as React from 'react'
import type {Props} from './image-render.types'
import {collapseStyles} from '../../../../../styles'

export class ImageRender extends React.Component<Props> {
  videoRef: React.RefObject<HTMLVideoElement>

  constructor(props: Props) {
    super(props)
    this.videoRef = React.createRef<HTMLVideoElement>()
  }

  pauseVideo = () => {
    if (!this.videoRef.current) {
      return
    }
    this.videoRef.current.pause()
  }

  onVideoClick = () => {
    if (!this.videoRef.current) {
      return
    }
    this.videoRef.current
      .play()
      .then(() => {})
      .catch(() => {})
    this.videoRef.current.setAttribute('controls', 'controls')
    this.videoRef.current.setAttribute('disablepictureinpicture', 'disablepictureinpicture')
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
        style={collapseStyles([this.props.style, !this.props.loaded && {opacity: 0}])}
      >
        <source src={this.props.videoSrc} />
      </video>
    ) : (
      <img
        onLoad={this.props.onLoad}
        draggable={false}
        src={this.props.src}
        style={collapseStyles([this.props.style, !this.props.loaded && {opacity: 0}])}
      />
    )
  }
}

export function imgMaxWidth() {
  return 320
}

export function imgMaxWidthRaw() {
  return 320
}
