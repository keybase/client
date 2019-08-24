import * as React from 'react'
import {Props} from './image-render.types'
import {collapseStyles} from '../../../../../styles'

export class ImageRender extends React.Component<Props> {
  videoRef: any

  constructor(props: Props) {
    super(props)
    this.videoRef = React.createRef()
  }

  pauseVideo = () => {
    if (!(this.videoRef && this.videoRef.current)) {
      return
    }
    this.videoRef.current.pause()
  }

  onVideoClick = () => {
    if (!(this.videoRef && this.videoRef.current)) {
      return
    }
    this.videoRef.current.play()
    this.videoRef.current.setAttribute('controls', 'controls')
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
      </video>
    ) : (
      <img
        onLoad={this.props.onLoad}
        draggable={false}
        src={this.props.src}
        style={collapseStyles([this.props.style, !this.props.loaded && {display: 'none'}])}
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
