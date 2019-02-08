// @flow
import * as React from 'react'
import fs from 'fs'
import Banner from '../bottom-banner/container'
import HeaderArea from '../header-area/container'
import InputArea from '../input-area/container'
import ListArea from '../list-area/container'
import logger from '../../../logger'
import {Box, Icon, LoadingLine, Text} from '../../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../../styles'
import {readImageFromClipboard} from '../../../util/clipboard.desktop'
import type {Props} from './index.types'
import '../conversation.css'

type State = {|
  showDropOverlay: boolean,
|}

const DropOverlay = ({onDragLeave, onDrop}) => (
  <Box style={dropOverlayStyle} onDragLeave={onDragLeave} onDrop={onDrop}>
    <Icon type="icon-dropping-file-48" />
  </Box>
)

const Offline = () => (
  <Box
    style={{
      ...globalStyles.flexBoxCenter,
      backgroundColor: globalColors.black_10,
      flex: 1,
      maxHeight: globalMargins.medium,
    }}
  >
    <Text type="BodySmallSemibold">
      Couldn't load all chat messages due to network connectivity. Retrying...
    </Text>
  </Box>
)

class Conversation extends React.PureComponent<Props, State> {
  _mounted = false
  state = {showDropOverlay: false}

  componentWillUnmount() {
    this._mounted = false
  }

  componentDidMount() {
    this._mounted = true
  }

  _onDrop = e => {
    if (!this._validDrag(e)) {
      return
    }
    const fileList = e.dataTransfer.files
    const paths = fileList.length ? Array.prototype.map.call(fileList, f => f.path) : []
    if (paths.length) {
      for (let path of paths) {
        // Check if any file is a directory and bail out if not
        try {
          // We do this synchronously
          // in testing, this is instantaneous
          // even when dragging many files
          const stat = fs.lstatSync(path)
          if (stat.isDirectory()) {
            // TODO show a red error banner on failure: https://zpl.io/2jlkMLm
            this.setState({showDropOverlay: false})
            return
          }
          // delegate to handler for any errors
        } catch (e) {
          logger.warn(`Error stating dropped attachment: ${e.code}`)
        }
      }
      this.props.onAttach(paths)
    }
    this.setState({showDropOverlay: false})
  }

  _validDrag = e => Array.prototype.map.call(e.dataTransfer.types, t => t).includes('Files')

  _onDragOver = e => {
    if (this._validDrag(e)) {
      e.dataTransfer.dropEffect = 'copy'
      this.setState({showDropOverlay: true})
    } else {
      e.dataTransfer.dropEffect = 'none'
    }
  }

  _onDragLeave = e => {
    this.setState({showDropOverlay: false})
  }

  _onPaste = e => {
    readImageFromClipboard(e, () => {
      this._mounted && this.setState({showDropOverlay: true})
    }).then(clipboardData => {
      this._mounted && this.setState({showDropOverlay: false})
      if (clipboardData) {
        this.props.onPaste(clipboardData)
      }
    })
  }

  render() {
    return (
      <Box
        className="conversation"
        style={containerStyle}
        onDragOver={this._onDragOver}
        onPaste={this._onPaste}
      >
        {this.props.threadLoadedOffline && <Offline />}
        <HeaderArea
          isPending={this.props.isPending}
          onToggleInfoPanel={this.props.onToggleInfoPanel}
          infoPanelOpen={this.props.infoPanelOpen}
          conversationIDKey={this.props.conversationIDKey}
        />
        {this.props.showLoader && <LoadingLine />}
        <ListArea
          isPending={this.props.isPending}
          onFocusInput={this.props.onFocusInput}
          scrollListDownCounter={this.props.scrollListDownCounter}
          scrollListUpCounter={this.props.scrollListUpCounter}
          conversationIDKey={this.props.conversationIDKey}
        />
        <Banner conversationIDKey={this.props.conversationIDKey} />
        <InputArea
          isPending={this.props.isPending}
          focusInputCounter={this.props.focusInputCounter}
          onRequestScrollDown={this.props.onRequestScrollDown}
          onRequestScrollUp={this.props.onRequestScrollUp}
          conversationIDKey={this.props.conversationIDKey}
        />
        {this.state.showDropOverlay && <DropOverlay onDragLeave={this._onDragLeave} onDrop={this._onDrop} />}
      </Box>
    )
  }
}

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  position: 'relative',
}

const dropOverlayStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  backgroundColor: globalColors.blue_60,
  bottom: 0,
  flex: 1,
  justifyContent: 'center',
  left: 0,
  position: 'absolute',
  right: 0,
  top: 0,
}

export default Conversation
