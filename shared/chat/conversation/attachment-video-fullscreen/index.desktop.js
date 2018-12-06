// @flow
import * as React from 'react'
import {
  Box,
  Text,
  PopupDialog,
  ProgressIndicator,
  OverlayParentHOC,
  type OverlayParentProps,
} from '../../../common-adapters'
import {collapseStyles, globalColors, globalMargins, globalStyles} from '../../../styles'
import type {Props} from './index.types'

type State = {loaded: boolean}
class _Fullscreen extends React.Component<Props & OverlayParentProps, State> {
  vidRef: any
  playingVideo: boolean
  state = {loaded: false}
  _setLoaded = () => this.setState({loaded: true})

  componentDidMount = () => {
    if (this.vidRef) {
      this.vidRef.play()
      this.playingVideo = true
    }
  }

  _onMouseDown = () => {
    if (!this.vidRef) {
      return
    }
    if (!this.playingVideo) {
      this.vidRef.play()
    } else {
      this.vidRef.pause()
    }
    this.playingVideo = !this.playingVideo
  }
  render() {
    return (
      <PopupDialog
        onClose={this.props.onClose}
        onMouseDown={this._onMouseDown}
        styleContainer={{height: null, maxHeight: '100%', width: '100%'}}
      >
        <Box style={containerStyle}>
          <Box style={headerFooterStyle}>
            <Text type="BodySemibold" style={{color: globalColors.black_75, flex: 1}}>
              {this.props.title}
            </Text>
          </Box>
          <Box style={collapseStyles([this.state.loaded ? null : {display: 'none'}])}>
            {this.props.path && (
              <video
                ref={ref => {
                  this.vidRef = ref
                }}
                style={styleImageFit}
                onLoadedMetadata={this._setLoaded}
                controlsList="nodownload nofullscreen noremoteplayback"
                controls={true}
              >
                <source src={this.props.path} />
              </video>
            )}
          </Box>
          {!this.state.loaded && <ProgressIndicator style={{margin: 'auto'}} />}
        </Box>
      </PopupDialog>
    )
  }
}

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  width: '100%',
}

const headerFooterStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  height: 32,
  paddingLeft: globalMargins.tiny,
  paddingRight: globalMargins.tiny,
  width: '100%',
}

const styleImageFit = {
  display: 'block',
  margin: 'auto',
  maxWidth: '100%',
  objectFit: 'scale-down',
  padding: '5px',
}

const VideoFullscreen = OverlayParentHOC(_Fullscreen)
export default VideoFullscreen
