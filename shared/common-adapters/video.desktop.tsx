import * as React from 'react'
import Measure from 'react-measure'
import type {Props, State} from './video'
import * as Styles from '../styles'
import {getVideoSize, CheckURL} from './video.shared'

export default class extends React.PureComponent<Props, State> {
  state = {
    containerHeight: 0,
    containerWidth: 0,
    loadedVideoSize: false,
    videoHeight: 0,
    videoWidth: 0,
  }

  _mounted = false

  _onContainerResize = ({bounds}) =>
    this._mounted && this.setState({containerHeight: bounds.height, containerWidth: bounds.width})

  _videoRef: {
    current: HTMLVideoElement | null
  } = React.createRef()
  _onVideoClick = () => {
    this._videoRef.current &&
      (this._videoRef.current.paused
        ? this._videoRef.current
            .play()
            .then(() => {})
            .catch(() => {})
        : this._videoRef.current.pause())
  }

  _onVideoLoadedmetadata = ({target}) => {
    this._mounted &&
      this.setState({
        loadedVideoSize: true,
        videoHeight: target.videoHeight,
        videoWidth: target.videoWidth,
      })
  }

  componentDidMount() {
    this._mounted = true
  }

  componentWillUnmount() {
    this._mounted = false
  }

  render() {
    const {onUrlError} = this.props
    return (
      <CheckURL url={this.props.url} allowFile={this.props.allowFile}>
        <Measure bounds={true} onResize={this._onContainerResize}>
          {({measureRef}) => (
            <div ref={measureRef} style={Styles.collapseStyles([styles.container, this.props.style])}>
              <video
                controlsList="nodownload nofullscreen"
                onClick={this._onVideoClick}
                ref={this._videoRef}
                controls={!this.props.hideControls}
                src={this.props.url}
                style={Styles.collapseStyles([styles.container, getVideoSize(this.state)])}
                muted={this.props.muted ?? true}
                autoPlay={true}
                preload="metadata"
                onLoadedMetadata={this._onVideoLoadedmetadata}
                onError={onUrlError && (() => onUrlError('video loading error'))}
              />
            </div>
          )}
        </Measure>
      </CheckURL>
    )
  }
}

const styles = Styles.styleSheetCreate(() => ({
  container: {
    ...Styles.globalStyles.flexBoxColumn,
    ...Styles.globalStyles.flexBoxCenter,
    height: '100%',
    maxHeight: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
    width: '100%',
  },
  video: Styles.platformStyles({
    isElectron: {
      maxHeight: '100%',
      maxWidth: '100%',
      objectFit: 'contain',
      position: 'absolute',
    },
  }),
}))
