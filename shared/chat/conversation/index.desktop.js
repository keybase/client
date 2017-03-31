// @flow
import Banner from './banner'
import Header from './header/container'
import Input from './input/container'
import List from './list.desktop'
import OldProfileResetNotice from './notices/old-profile-reset-notice'
import NoConversation from './no-conversation.desktop'
import ParticipantRekey from './participant-rekey.desktop'
import React, {Component} from 'react'
import SidePanel from './side-panel'
import YouRekey from './you-rekey.desktop.js'
import {Box, Icon, Text} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {readImageFromClipboard} from '../../util/clipboard.desktop'
import * as Constants from '../../constants/chat'
import hoc from './index-hoc'
import {branch, renderComponent} from 'recompose'

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

  // Wrapped to stop churn to input
  _onEditLastMessage = () => {
    this.props.onEditLastMessage()
  }

  render () {
    const {
      bannerMessage,
      finalizeInfo,
      followingMap,
      metaDataMap,
      muted,
      onAddParticipant,
      onBack,
      onMuteConversation,
      onShowBlockConversationDialog,
      onShowProfile,
      onToggleSidePanel,
      participants,
      selectedConversationIDKey,
      sidePanelOpen,
      you,
    } = this.props

    const banner = bannerMessage && <Banner message={bannerMessage} />
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
        <Header sidePanelOpen={sidePanelOpen} onToggleSidePanel={onToggleSidePanel} onBack={onBack} selectedConversationIDKey={selectedConversationIDKey} />
        <List {...this.props.listProps} />
        {banner}
        {finalizeInfo
          ? <OldProfileResetNotice
            onOpenNewerConversation={this.props.onOpenNewerConversation}
            username={finalizeInfo.resetUser} />
            : <Input
              focusInputCounter={this.props.focusInputCounter}
              onEditLastMessage={this._onEditLastMessage}
              onStoreInputText={this.props.onStoreInputText}
              selectedConversationIDKey={this.props.selectedConversationIDKey}
              onScrollDown={this.props.onScrollDown}
            /> }
        {sidePanelOpen && <div style={{...globalStyles.flexBoxColumn, bottom: 0, position: 'absolute', right: 0, top: 35, width: 320}}>
          <SidePanel
            you={you}
            metaDataMap={metaDataMap}
            followingMap={followingMap}
            muted={muted}
            onAddParticipant={onAddParticipant}
            onMuteConversation={onMuteConversation}
            onShowBlockConversationDialog={onShowBlockConversationDialog}
            onShowProfile={onShowProfile}
            onToggleSidePanel={onToggleSidePanel}
            participants={participants} />
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

export default branch(
  (props: Props) => props.selectedConversationIDKey === Constants.nothingSelected,
  renderComponent(NoConversation),
  branch(
    (props: Props) => !!props.rekeyInfo && !props.finalizeInfo,
    branch(
      (props: Props) => props.rekeyInfo && props.rekeyInfo.get('rekeyParticipants').count(),
      renderComponent(ParticipantRekey),
      renderComponent(YouRekey)
    )
  )
)(hoc(Conversation))
