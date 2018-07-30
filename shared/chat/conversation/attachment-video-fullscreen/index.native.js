// @flow
import React from 'react'
import {WebView, Box, ClickableBox, Text} from '../../../common-adapters'
import {globalColors, platformStyles, globalMargins, globalStyles} from '../../../styles'
import {FloatingMenuParentHOC, type FloatingMenuParentProps} from '../../../common-adapters/floating-menu'
import type {Props} from './index.types'

class _VideoFullscreen extends React.Component<Props & FloatingMenuParentProps, {loaded: boolean}> {
  state = {loaded: false}
  _setLoaded = () => this.setState({loaded: true})
  render() {
    return (
      <Box style={stylesContainer}>
        <Box style={stylesHeader}>
          <ClickableBox onClick={this.props.onClose} style={stylesCloseBox}>
            <Text type="Body" style={stylesText}>
              Close
            </Text>
          </ClickableBox>
        </Box>
        <Box style={stylesContentContainer}>
          <WebView styles={stylesAVView} url={this.props.path} onLoad={this._setLoaded} />
        </Box>
      </Box>
    )
  }
}

const stylesContainer = platformStyles({
  common: {
    ...globalStyles.flexBoxColumn,
    ...globalStyles.flexGrow,
    backgroundColor: globalColors.black,
  },
  isIOS: {
    marginTop: -20, // top status bar
  },
})

const stylesContentContainer = platformStyles({
  common: {
    ...globalStyles.flexGrow,
    backgroundColor: globalColors.black,
  },
})

const stylesText = {
  color: globalColors.white,
  lineHeight: 48,
}

const stylesHeader = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  paddingLeft: globalMargins.tiny,
}

const stylesCloseBox = {
  paddingLeft: globalMargins.tiny,
  height: 48,
  width: 64,
}

const stylesAVView = {
  backgroundColor: globalColors.blue5,
}

const VideoFullscreen = FloatingMenuParentHOC(_VideoFullscreen)

export default VideoFullscreen
