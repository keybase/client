// @flow
import Banner from './banner/container'
import Header from './header/container'
import Input from './input/container'
import List from './list/container'
import OldProfileResetNotice from './notices/old-profile-reset-notice/container'
import React, {Component} from 'react'
import SidePanel from './side-panel/container'
import {Box, Icon, Text, LoadingLine} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {readImageFromClipboard} from '../../util/clipboard.desktop'

import type {Props} from '.'

type State = {
  showDropOverlay: boolean,
}

class Conversation extends Component<void, Props, State> {
  state = {
    showDropOverlay: false,
  }

  _onDrop = e => {
    const fileList = e.dataTransfer.files
    if (!this.props.selectedConversationIDKey) throw new Error('No conversation')
    const conversationIDKey = this.props.selectedConversationIDKey
    // FileList, not an array
    const inputs = Array.prototype.map.call(fileList, file => ({
      conversationIDKey,
      filename: file.path,
      title: file.name,
      type: file.type,
    }))
    this.props.onAttach(inputs)
    this.setState({showDropOverlay: false})
  }

  _onDragEnter = e => {
    e.dataTransfer.effectAllowed = 'copy'
    this.setState({showDropOverlay: true})
  }

  _onDragLeave = e => {
    this.setState({showDropOverlay: false})
  }

  _onPaste = e => {
    // TODO: Should we read/save the clipboard data on the main thread?
    readImageFromClipboard(e, () => {
      this.setState({showDropOverlay: true})
    }).then(clipboardData => {
      this.setState({showDropOverlay: false})
      if (!this.props.selectedConversationIDKey) throw new Error('No conversation')
      if (clipboardData) {
        const {path, title} = clipboardData
        this.props.onAttach([{
          conversationIDKey: this.props.selectedConversationIDKey,
          filename: path,
          title,
          type: 'Image',
        }])
      }
    })
  }

  render () {
    const dropOverlay = this.state.showDropOverlay && (
      <Box style={dropOverlayStyle} onDragLeave={this._onDragLeave} onDrop={this._onDrop}>
        <Icon type='icon-file-dropping-48' />
      </Box>
    )

    const offline = this.props.threadLoadedOffline && (
      <Box style={{...globalStyles.flexBoxCenter, backgroundColor: globalColors.black_10, flex: 1, maxHeight: globalMargins.medium}}>
        <Text type='BodySmallSemibold'>Couldn't load all chat messages due to network connectivity. Retrying...</Text>
      </Box>
    )

    return (
      <Box className='conversation' style={containerStyle} onDragEnter={this._onDragEnter} onPaste={this._onPaste}>
        {offline}
        <Header sidePanelOpen={this.props.sidePanelOpen} onToggleSidePanel={this.props.onToggleSidePanel} onBack={this.props.onBack} />
        <List
          focusInputCounter={this.props.focusInputCounter}
          listScrollDownCounter={this.props.listScrollDownCounter}
          onEditLastMessage={this.props.onEditLastMessage}
          onScrollDown={this.props.onScrollDown}
          onFocusInput={this.props.onFocusInput}
          editLastMessageCounter={this.props.editLastMessageCounter}
        />
        <Banner />
        {this.props.showLoader && <LoadingLine />}
        {this.props.finalizeInfo
          ? <OldProfileResetNotice />
          : <Input
            focusInputCounter={this.props.focusInputCounter}
            onEditLastMessage={this.props.onEditLastMessage}
            onScrollDown={this.props.onScrollDown}
          /> }
        {this.props.sidePanelOpen && <div style={{...globalStyles.flexBoxColumn, bottom: 0, position: 'absolute', right: 0, top: 35, width: 320}}>
          <SidePanel onToggleSidePanel={this.props.onToggleSidePanel} />
        </div>}
        {dropOverlay}
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
  backgroundColor: globalColors.blue5_60,
  bottom: 0,
  flex: 1,
  justifyContent: 'center',
  left: 0,
  position: 'absolute',
  right: 0,
  top: 0,
}

export default Conversation
