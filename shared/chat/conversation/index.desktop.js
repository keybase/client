// @flow
import Banner from './banner'
import Header from './header.desktop'
import Input from './input.desktop'
import List from './list.desktop'
import OldProfileResetNotice from './notices/old-profile-reset-notice'
import NoConversation from './no-conversation.desktop'
import ParticipantRekey from './participant-rekey.desktop'
import React, {Component} from 'react'
import SidePanel from './side-panel'
import YouRekey from './you-rekey.desktop.js'
import {Box, Icon} from '../../common-adapters'
import {globalStyles, globalColors} from '../../styles'
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
    if (!this.props.selectedConversation) throw new Error('No conversation')
    const conversationIDKey = this.props.selectedConversation
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
      if (!this.props.selectedConversation) throw new Error('No conversation')
      if (clipboardData) {
        const {path, title} = clipboardData
        this.props.onAttach([{
          conversationIDKey: this.props.selectedConversation,
          filename: path,
          title,
          type: 'Image',
        }])
      }
    })
  }

  render () {
    const {
      bannerMessage,
      followingMap,
      metaDataMap,
      onAddParticipant,
      onMuteConversation,
      onShowProfile,
      onToggleSidePanel,
      muted,
      participants,
      sidePanelOpen,
      you,
      finalizeInfo,
    } = this.props

    const banner = bannerMessage && <Banner message={bannerMessage} />
    const dropOverlay = this.state.showDropOverlay && (
      <Box style={dropOverlayStyle} onDragLeave={this._onDragLeave} onDrop={this._onDrop}>
        <Icon type='icon-file-dropping-48' />
      </Box>
    )

    return (
      <Box className='conversation' style={containerStyle} onDragEnter={this._onDragEnter} onPaste={this._onPaste}>
        <Header {...this.props.headerProps} />
        <List {...this.props.listProps} />
        {banner}
        {finalizeInfo
          ? <OldProfileResetNotice
            onOpenNewerConversation={this.props.onOpenNewerConversation}
            username={finalizeInfo.resetUser} />
          : <Input {...this.props.inputProps} /> }
        {sidePanelOpen && <div style={{...globalStyles.flexBoxColumn, bottom: 0, position: 'absolute', right: 0, top: 35, width: 320}}>
          <SidePanel
            you={you}
            metaDataMap={metaDataMap}
            followingMap={followingMap}
            muted={muted}
            onAddParticipant={onAddParticipant}
            onMuteConversation={onMuteConversation}
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
  (props: Props) => props.selectedConversation === Constants.nothingSelected,
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
