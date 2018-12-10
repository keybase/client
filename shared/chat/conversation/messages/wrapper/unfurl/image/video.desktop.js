// @flow
import * as React from 'react'
import * as Kb from '../../../../../../common-adapters/index'
import * as Styles from '../../../../../../styles'
import type {Props} from './video.types'

export class Video extends React.Component<Props> {
  videoRef: any
  playingVideo: boolean
  constructor(props: Props) {
    super(props)
    this.videoRef = React.createRef()
    this.playingVideo = props.autoPlay
  }
  _onClick = () => {
    if (!(this.videoRef && this.videoRef.current)) {
      return
    }
    if (!this.playingVideo) {
      this.videoRef.current.play()
    } else {
      this.videoRef.current.pause()
    }
    this.playingVideo = !this.playingVideo
  }
  render() {
    return (
      <React.Fragment>
        {!this.playingVideo && (
          <Kb.Icon type={'icon-play-64'} style={Kb.iconCastPlatformStyles(styles.playButton)} />
        )}
        <video
          ref={this.videoRef}
          onClick={this._onClick}
          autoPlay={this.props.autoPlay}
          muted={true}
          src={this.props.url}
          style={this.props.style}
          loop={true}
        />
      </React.Fragment>
    )
  }
}

const styles = Styles.styleSheetCreate({
  playButton: {
    bottom: '50%',
    left: '50%',
    marginBottom: -32,
    marginLeft: -32,
    marginRight: -32,
    marginTop: -32,
    position: 'absolute',
    right: '50%',
    top: '50%',
  },
})
