// @flow
import React from 'react'
import {Box, Icon} from '../../common-adapters'
import {globalStyles, globalColors} from '../../styles'
import Header from './header.desktop'
import List from './list.desktop'
import Input from './input.desktop'
import Banner from './banner'

import type {Props} from '.'
import type {Props as BannerMessage} from './banner'

const Conversation = (props: Props) => {
  const bannerMessage: ?BannerMessage = props.bannerMessage
  // $FlowIssue with variants
  const banner = bannerMessage && <Banner {...bannerMessage} />

  const onDragOver = e => {
    e.dataTransfer.effectAllowed = 'copy'
    console.log('aaaaaaaaaa drag over', e)
    e.preventDefault()
  }

  const onDrop = e => {
    console.log('aaaaaaaaaa drop', e)
  }

  const dropOverlay = (
    <Box style={dropOverlayStyle}>
      <Icon type='icon-file-dropping-48' />
    </Box>
  )

  return (
    <Box className='conversation' style={containerStyle} onDragOver={onDragOver} onDrop={onDrop}>
      <Header
        onOpenFolder={props.onOpenFolder}
        onToggleSidePanel={props.onToggleSidePanel}
        participants={props.participants}
        sidePanelOpen={props.sidePanelOpen}
        you={props.you}
        metaDataMap={props.metaDataMap}
        followingMap={props.followingMap}
        onShowProfile={props.onShowProfile}
      />
      <List
        you={props.you}
        metaDataMap={props.metaDataMap}
        followingMap={props.followingMap}
        firstNewMessageID={props.firstNewMessageID}
        listScrollDownState={props.listScrollDownState}
        messages={props.messages}
        moreToLoad={props.moreToLoad}
        onAddParticipant={props.onAddParticipant}
        onDeleteMessage={props.onDeleteMessage}
        onEditMessage={props.onEditMessage}
        onLoadAttachment={props.onLoadAttachment}
        onLoadMoreMessages={props.onLoadMoreMessages}
        onOpenInFileUI={props.onOpenInFileUI}
        onOpenInPopup={props.onOpenInPopup}
        onRetryAttachment={props.onRetryAttachment}
        onRetryMessage={props.onRetryMessage}
        onShowProfile={props.onShowProfile}
        participants={props.participants}
        selectedConversation={props.selectedConversation}
        sidePanelOpen={props.sidePanelOpen}
        validated={props.validated}
      />
      {banner}
      <Input
        emojiPickerOpen={props.emojiPickerOpen}
        isLoading={props.isLoading}
        onAttach={props.onAttach}
        onPostMessage={props.onPostMessage}
        selectedConversation={props.selectedConversation}
      />
      {dropOverlay}
    </Box>
  )
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
