// @flow
import Banner from './banner'
import Header from './header.desktop'
import Input from './input.desktop'
import List from './list.desktop'
import NoConversation from './no-conversation.desktop'
import ParticipantRekey from './participant-rekey.desktop'
import React, {Component} from 'react'
import SidePanel from './side-panel'
import YouRekey from './you-rekey.desktop.js'
import {Box, Icon} from '../../common-adapters'
import {globalStyles, globalColors} from '../../styles'
import {readImageFromClipboard} from '../../util/clipboard.desktop'
import {nothingSelected} from '../../constants/chat'
import {withHandlers, branch, renderComponent, compose} from 'recompose'

import type {Props} from '.'

type State = {
  showDropOverlay: boolean,
}

type EditLastHandlerProps = {
  onListRef: (list: React$Element<*>) => void,
  onEditLastMessage: () => void,
}

const withEditLastHandlers = withHandlers(() => {
  let _list
  return {
    onEditLastMessage: (props) => () => { _list && _list.onEditLastMessage() },
    onListRef: (props) => (list) => { _list = list },
  }
})

class Conversation extends Component<void, Props & EditLastHandlerProps, State> {
  _input: Input

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

  _onInputRef = (input) => {
    this._input = input
  }

  _onFocusInput = () => {
    this._input && this._input.focusInput()
  }

  componentWillUnmount () {
    if (this._input) {
      this.props.onStoreInputText(this._input.getValue())
    }
  }

  render () {
    const {
    // $FlowIssue with variants
      bannerMessage,
      emojiPickerOpen,
      firstNewMessageID,
      followingMap,
      isLoading,
      listScrollDownState,
      messages,
      metaDataMap,
      moreToLoad,
      onAddParticipant,
      onAttach,
      onDeleteMessage,
      onEditMessage,
      onEditLastMessage,
      onListRef,
      onLoadAttachment,
      onLoadMoreMessages,
      onMuteConversation,
      onOpenFolder,
      onOpenInFileUI,
      onOpenInPopup,
      onPostMessage,
      onRetryAttachment,
      onRetryMessage,
      onShowProfile,
      onToggleSidePanel,
      muted,
      participants,
      selectedConversation,
      sidePanelOpen,
      validated,
      you,
    } = this.props

    const banner = bannerMessage && <Banner {...bannerMessage} />

    const dropOverlay = this.state.showDropOverlay && (
      <Box style={dropOverlayStyle} onDragLeave={this._onDragLeave} onDrop={this._onDrop}>
        <Icon type='icon-file-dropping-48' />
      </Box>
    )
    return (
      <Box className='conversation' style={containerStyle} onDragEnter={this._onDragEnter} onPaste={this._onPaste}>
        <Header
          onOpenFolder={onOpenFolder}
          onToggleSidePanel={onToggleSidePanel}
          participants={participants}
          muted={muted}
          sidePanelOpen={sidePanelOpen}
          you={you}
          metaDataMap={metaDataMap}
          followingMap={followingMap}
          onShowProfile={onShowProfile}
        />
        <List
          you={you}
          metaDataMap={metaDataMap}
          followingMap={followingMap}
          firstNewMessageID={firstNewMessageID}
          listScrollDownState={listScrollDownState}
          messages={messages}
          moreToLoad={moreToLoad}
          muted={muted}
          onDeleteMessage={onDeleteMessage}
          onEditMessage={onEditMessage}
          onFocusInput={this._onFocusInput}
          onLoadAttachment={onLoadAttachment}
          onLoadMoreMessages={onLoadMoreMessages}
          onOpenInFileUI={onOpenInFileUI}
          onOpenInPopup={onOpenInPopup}
          onRetryAttachment={onRetryAttachment}
          onRetryMessage={onRetryMessage}
          ref={onListRef}
          selectedConversation={selectedConversation}
          sidePanelOpen={sidePanelOpen}
          validated={validated}
        />
        {banner}
        <Input
          ref={this._onInputRef}
          defaultText={this.props.inputText}
          emojiPickerOpen={emojiPickerOpen}
          isLoading={isLoading}
          onAttach={onAttach}
          onEditLastMessage={onEditLastMessage}
          onPostMessage={onPostMessage}
          selectedConversation={selectedConversation}
        />
        {sidePanelOpen && <div style={{...globalStyles.flexBoxColumn, bottom: 0, position: 'absolute', right: 0, top: 35, width: 320}}>
          <SidePanel
            you={you}
            metaDataMap={metaDataMap}
            followingMap={followingMap}
            muted={muted}
            onAddParticipant={onAddParticipant}
            onMuteConversation={onMuteConversation}
            onShowProfile={onShowProfile}
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
  (props: Props) => props.selectedConversation === nothingSelected,
  renderComponent(NoConversation),
  branch(
    (props: Props) => !!props.rekeyInfo,
    branch(
      (props: Props) => props.rekeyInfo && props.rekeyInfo.get('rekeyParticipants').count(),
      renderComponent(ParticipantRekey),
      renderComponent(YouRekey)
    ),
    compose(withEditLastHandlers)
  )
)(Conversation)
