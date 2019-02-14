// @flow
import * as React from 'react'
import type {Props, State} from './video'
import Box from './box'
import * as Styles from '../styles'
import {getVideoSize} from './video.shared'

export default class extends React.PureComponent<Props, State> {
  state = {
    containerHeight: 0,
    containerWidth: 0,
    loadedVideoSize: false,
    videoHeight: 0,
    videoWidth: 0,
  }

  _setVideoSize = ({target}) => {
    this.setState({
      loadedVideoSize: true,
      // $FlowIssue
      videoHeight: target.videoHeight,
      // $FlowIssue
      videoWidth: target.videoWidth,
    })
  }
  _removeVideoListener = () => {}
  _videoRef = ref => {
    if (!ref) {
      return
    }
    ref.addEventListener('loadedmetadata', this._setVideoSize)
    this._removeVideoListener = () => ref.removeEventListener('loadedmetadata', this._setVideoSize)
  }

  _updateContainerSize = () =>
    this._containerRef &&
    this.setState({
      containerHeight: this._containerRef.getBoundingClientRect().height,
      containerWidth: this._containerRef.getBoundingClientRect().width,
    })
  _containerRef: any = null
  _setContainerRef = ref => {
    this._containerRef = ref
    this._updateContainerSize()
  }

  _resizeInFly = false
  _onResize = () => {
    if (this._resizeInFly) {
      return
    }
    this._resizeInFly = true
    setTimeout(() => {
      this._resizeInFly = false
      this._updateContainerSize()
    }, 200)
  }

  componentDidMount() {
    window.addEventListener('resize', this._onResize)
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this._onResize)
    this._removeVideoListener()
  }

  render() {
    return (
      <Box
        forwardedRef={this._setContainerRef}
        style={Styles.collapseStyles([styles.container, this.props.style])}
      >
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
      </Box>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: {
    // can't use Box2 as it doesn't have forwardedRef
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
