// @flow
import React from 'react'
import {Box} from '../../common-adapters'
import {globalStyles} from '../../styles'
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

  let _input
  return (
    <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
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
        onFocusInput={() => _input && _input.focusInput()}
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
        ref={(input) => { _input = input }}
        emojiPickerOpen={props.emojiPickerOpen}
        isLoading={props.isLoading}
        onAttach={props.onAttach}
        onPostMessage={props.onPostMessage}
        selectedConversation={props.selectedConversation}
      />
    </Box>
  )
}

export default Conversation
