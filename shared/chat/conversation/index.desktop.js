// @flow
import Banner from './banner'
import Header from './header.desktop'
import Input from './input.desktop'
import List from './list.desktop'
import NoConversation from './no-conversation'
import React, {Component} from 'react'
import {Box, Icon} from '../../common-adapters'
import {globalStyles, globalColors} from '../../styles'
import {readImageFromClipboard} from '../../util/clipboard.desktop'
import {nothingSelected} from '../../constants/chat'
import {withHandlers, branch, renderComponent, compose} from 'recompose'

import type {Props} from '.'

type State = {
  showDropOverlay: boolean,
}

type FocusHandlerProps = {
  onInputRef: (input: React$Element<*>) => void,
  onFocusInput: () => void,
}

const withFocusHandlers = withHandlers(() => {
  let _input
  return {
    onInputRef: (props) => (input) => { _input = input },
    onFocusInput: (props) => () => { _input && _input.focusInput() },
  }
})

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

class Conversation extends Component<void, Props & FocusHandlerProps & EditLastHandlerProps, State> {
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
      onFocusInput,
      onEditLastMessage,
      onInputRef,
      onListRef,
      onLoadAttachment,
      onLoadMoreMessages,
      onOpenFolder,
      onOpenInFileUI,
      onOpenInPopup,
      onPostMessage,
      onRetryAttachment,
      onRetryMessage,
      onShowProfile,
      onToggleSidePanel,
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
          onAddParticipant={onAddParticipant}
          onDeleteMessage={onDeleteMessage}
          onEditMessage={onEditMessage}
          onFocusInput={onFocusInput}
          onLoadAttachment={onLoadAttachment}
          onLoadMoreMessages={onLoadMoreMessages}
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
        <Input
          ref={onInputRef}
          emojiPickerOpen={emojiPickerOpen}
          isLoading={isLoading}
          onAttach={onAttach}
          onEditLastMessage={onEditLastMessage}
          onPostMessage={onPostMessage}
          selectedConversation={selectedConversation}
        />
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
  compose(withFocusHandlers, withEditLastHandlers)
)(Conversation)
