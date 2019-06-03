import * as React from 'react'
import * as Kb from '../../../../../../common-adapters/index'
import * as Styles from '../../../../../../styles'
import {Props} from './video.types'

type State = {
  playingVideo: boolean
}

export class Video extends React.Component<Props, State> {
  _videoRef = React.createRef<HTMLVideoElement>()
  state = {playingVideo: this.props.autoPlay}
  _onClick = () => {
    if (this.props.onClick) {
      this.props.onClick()
      return
    }
    if (!this._videoRef.current) {
      return
    }
    if (!this.state.playingVideo) {
      this._videoRef.current.play()
    } else {
      this._videoRef.current.pause()
    }
    this.setState({playingVideo: !this.state.playingVideo})
  }
  render() {
    return (
      <Kb.Box2 direction="horizontal" style={styles.container}>
        <Kb.Box
          style={Styles.collapseStyles([
            styles.absoluteContainer,
            {
              height: this.props.height,
              width: this.props.width,
            },
          ])}
        >
          {!this.state.playingVideo && (
            <Kb.Icon type={'icon-play-64'} style={Kb.iconCastPlatformStyles(styles.playButton)} />
          )}
        </Kb.Box>
        <video
          ref={this._videoRef}
          onClick={this._onClick}
          autoPlay={this.props.autoPlay}
          muted={true}
          src={this.props.url}
          style={this.props.style}
          loop={true}
        />
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  absoluteContainer: {
    left: 0,
    position: 'absolute',
    top: 0,
  },
  container: {
    alignSelf: 'flex-start',
    position: 'relative',
  },
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
