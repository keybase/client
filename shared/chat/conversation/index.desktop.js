// @flow
import * as Immutable from 'immutable'
import Banner from './banner'
import Header from './header.desktop'
import Input from './input.desktop'
import List from './list.desktop'
import OldProfileResetNotice from './notices/old-profile-reset-notice'
import NoConversation from './no-conversation.desktop'
import ParticipantRekey from './participant-rekey.desktop'
import React, {Component} from 'react'
import YouRekey from './you-rekey.desktop.js'
import {Box, Icon} from '../../common-adapters'
import {globalStyles, globalColors} from '../../styles'
import {readImageFromClipboard} from '../../util/clipboard.desktop'
import * as Constants from '../../constants/chat'
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
    // FileList, not an array
    const files = Array.prototype.map.call(fileList, file => ({
      name: file.name,
      path: file.path,
      type: file.type,
    }))
    files.forEach(f => {
      this.props.onAttach(f.path, f.name, f.type.includes('image/') ? 'Image' : 'Other')
    })
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
      if (clipboardData) {
        const {path, title} = clipboardData
        this.props.onAttach(path, title, 'Image')
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

  _decorateSupersedes (messages: Immutable.List<Constants.Message>): Immutable.List<Constants.Message> {
    if (this.props.supersedes && !this.props.moreToLoad) {
      const {conversationIDKey, finalizeInfo: {resetUser}} = this.props.supersedes
      const supersedesMessage: Constants.SupersedesMessage = {
        type: 'Supersedes',
        supersedes: conversationIDKey,
        username: resetUser,
        timestamp: Date.now(),
        key: `supersedes-${conversationIDKey}-${resetUser}`,
      }
      return messages.unshift(supersedesMessage)
    }

    return messages
  }

  _decorateMessages (messages: Immutable.List<Constants.Message>): Immutable.List<Constants.Message> {
    return this._decorateSupersedes(messages)
  }

  _openNewerConversation = () => {
    if (this.props.supersededBy) {
      this.props.onOpenConversation(this.props.supersededBy.conversationIDKey)
    } else {
      // Open new conversation
      this.props.restartConversation()
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
      onOpenConversation,
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
      finalizeInfo,
    } = this.props

    const banner = bannerMessage && <Banner {...bannerMessage} />

    const dropOverlay = this.state.showDropOverlay && (
      <Box style={dropOverlayStyle} onDragLeave={this._onDragLeave} onDrop={this._onDrop}>
        <Icon type='icon-file-dropping-48' />
      </Box>
    )

    const decoratedMesssages = this._decorateMessages(messages)

    return (
      <Box className='conversation' style={containerStyle} onDragEnter={this._onDragEnter} onPaste={this._onPaste}>
        <Header
          onOpenFolder={onOpenFolder}
          onToggleSidePanel={onToggleSidePanel}
          participants={participants}
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
          messages={decoratedMesssages}
          moreToLoad={moreToLoad}
          muted={muted}
          onAddParticipant={onAddParticipant}
          onDeleteMessage={onDeleteMessage}
          onEditMessage={onEditMessage}
          onFocusInput={this._onFocusInput}
          onLoadAttachment={onLoadAttachment}
          onLoadMoreMessages={onLoadMoreMessages}
          onMuteConversation={onMuteConversation}
          onOpenConversation={onOpenConversation}
          onOpenInFileUI={onOpenInFileUI}
          onOpenInPopup={onOpenInPopup}
          onRetryAttachment={onRetryAttachment}
          onRetryMessage={onRetryMessage}
          onShowProfile={onShowProfile}
          participants={participants}
          ref={onListRef}
          selectedConversation={selectedConversation}
          sidePanelOpen={sidePanelOpen}
          validated={validated}
        />
        {banner}
        {finalizeInfo
          ? <OldProfileResetNotice
            onOpenNewerConversation={this._openNewerConversation}
            username={finalizeInfo.resetUser}
          />
          : <Input
            ref={this._onInputRef}
            defaultText={this.props.inputText}
            emojiPickerOpen={emojiPickerOpen}
            isLoading={isLoading}
            onAttach={onAttach}
            onEditLastMessage={onEditLastMessage}
            onPostMessage={onPostMessage}
            selectedConversation={selectedConversation}
          /> }
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
    (props: Props) => !!props.rekeyInfo,
    branch(
      (props: Props) => props.rekeyInfo && props.rekeyInfo.get('rekeyParticipants').count(),
      renderComponent(ParticipantRekey),
      renderComponent(YouRekey)
    ),
    compose(withEditLastHandlers)
  )
)(Conversation)
