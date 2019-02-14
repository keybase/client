// @flow
import * as React from 'react'
import Measure from 'react-measure'
import type {Props, State} from './video'
import * as Styles from '../styles'
import {getVideoSize} from './video.shared'
import logger from '../logger'

export default class extends React.PureComponent<Props, State> {
  state = {
    containerHeight: 0,
    containerWidth: 0,
    loadedVideoSize: false,
    videoHeight: 0,
    videoWidth: 0,
  }

  _mounted = false

  _onVideoLoadedmetadata = ({target}) => {
    this._mounted &&
      this.setState({
        loadedVideoSize: true,
        // $FlowIssue doesn't know videoHeight
        videoHeight: target.videoHeight,
        // $FlowIssue doesn't know videoWidth
        videoWidth: target.videoWidth,
      })
  }

  _onContainerResize = ({bounds}) =>
    this.setState({containerHeight: bounds.height, containerWidth: bounds.width})

  _videoRef: {current: HTMLVideoElement | null} = React.createRef()

  componentDidMount() {
    this._mounted = true
    if (!this._videoRef.current) {
      // This can happen in story tests.
      logger.warn('_videoRef is falsey')
      return
    }
    this._videoRef.current.addEventListener('loadedmetadata', this._onVideoLoadedmetadata)
  }

  componentWillUnmount() {
    this._mounted = false
    if (!this._videoRef.current) {
      // This can happen in story tests.
      logger.warn('_videoRef is falsey')
      return
    }
    this._videoRef.current.removeEventListener('loadedmetadata', this._onVideoLoadedmetadata)
  }

  render() {
    return (
      <Measure bounds={true} onResize={this._onContainerResize}>
        {({measureRef}) => (
          <div ref={measureRef} style={Styles.collapseStyles([styles.container, this.props.style])}>
            <video
              controlsList="nodownload nofullscreen"
              ref={this._videoRef}
              controls={!this.props.hideControls}
              src={this.props.url}
              style={Styles.collapseStyles([styles.container, getVideoSize(this.state)])}
              muted={true}
              autoPlay={true}
              preload="metadata"
            />
          </div>
        )}
      </Measure>
    )
  }
}

const styles = Styles.styleSheetCreate({
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
})
