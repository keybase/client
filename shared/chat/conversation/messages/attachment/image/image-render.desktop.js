// @flow
import * as React from 'react'
import type {Props} from './image-render.types'
import {collapseStyles} from '../../../../../styles'
import {
  Box,
  Text,
  ClickableBox,
  Icon,
  ProgressBar,
  ProgressIndicator,
  iconCastPlatformStyles,
} from '../../../../../common-adapters'

export class ImageRender extends React.Component<Props> {
  constructor(props: Props) {
    super(props)
    this.video = React.createRef()
    this.onVideoClick = this.onVideoClick.bind(this)
    this.playingVideo = false
  }

  onVideoClick() {
    if (!this.playingVideo) {
      this.video.current.play()
    } else {
      this.video.current.pause()
    }
    this.playingVideo = !this.playingVideo
  }

  render() {
    return this.props.isVideo ? (
      <video
        ref={this.video}
        onLoadStart={this.props.onLoad}
        controlsList="nodownload nofullscreen noremoteplay"
        style={this.props.style}
      >
        <source src={this.props.src} />
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
