// @flow
import * as React from 'react'
import Banner from '../banner/container'
import HeaderArea from '../header-area/container'
import InputArea from '../input-area/container'
import ListArea from '../list-area/container'
import InfoPanel from '../info-panel/container'
import {Box, Icon, LoadingLine, Text} from '../../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../../styles'
import {readImageFromClipboard} from '../../../util/clipboard.desktop'

import type {Props} from '.'

type State = {
  infoPanelOpen: boolean,
  showDropOverlay: boolean,
}

const DropOverlay = ({onDragLeave, onDrop}) => (
  <Box style={dropOverlayStyle} onDragLeave={onDragLeave} onDrop={onDrop}>
    <Icon type="icon-file-dropping-48" />
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

const InfoPaneWrapper = ({onToggle}) => (
  <div
    style={{
      ...globalStyles.flexBoxColumn,
      bottom: 0,
      position: 'absolute',
      right: 0,
      top: 35,
      width: 320,
    }}
  >
    <InfoPanel onToggleInfoPanel={onToggle} />
  </div>
)

class Conversation extends React.PureComponent<Props, State> {
  _mounted = false
  state = {
    infoPanelOpen: false,
    showDropOverlay: false,
  }

  componentWillUnmount() {
    this._mounted = false
  }

  componentDidMount() {
    this._mounted = true
  }

  componentWillReceiveProps(nextProps: Props) {
    const convoChanged = this.props.conversationIDKey !== nextProps.conversationIDKey
    if (convoChanged) {
      this.setState({infoPanelOpen: false})
    }
  }

  _onDrop = e => {
    if (!this._validDrag(e)) {
      return
    }
    const fileList = e.dataTransfer.files
    const paths = fileList.length ? Array.prototype.map.call(fileList, f => f.path) : []
    if (paths) {
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
        const {path} = clipboardData
        if (path) {
          this.props.onAttach([path])
        }
      }
    })
  }

  _onToggleInfoPanel = () => {
    this.setState(prevState => ({infoPanelOpen: !prevState.infoPanelOpen}))
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
          onToggleInfoPanel={this._onToggleInfoPanel}
          infoPanelOpen={this.state.infoPanelOpen}
          conversationIDKey={this.props.conversationIDKey}
        />
        {this.props.showLoader && <LoadingLine />}
        <ListArea
          listScrollDownCounter={this.props.listScrollDownCounter}
          onFocusInput={this.props.onFocusInput}
          conversationIDKey={this.props.conversationIDKey}
        />
        <Banner conversationIDKey={this.props.conversationIDKey} />
        <InputArea
          focusInputCounter={this.props.focusInputCounter}
          onScrollDown={this.props.onScrollDown}
          conversationIDKey={this.props.conversationIDKey}
        />
        {this.state.infoPanelOpen && <InfoPaneWrapper onToggle={this._onToggleInfoPanel} />}
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
