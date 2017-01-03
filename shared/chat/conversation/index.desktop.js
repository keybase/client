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
  return (
    <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
      <Header
        onOpenFolder={props.onOpenFolder}
        onToggleSidePanel={props.onToggleSidePanel}
        participants={props.participants}
        sidePanelOpen={props.sidePanelOpen}
      />
      <List
        firstNewMessageID={props.firstNewMessageID}
        messages={props.messages}
        metaData={props.metaData}
        moreToLoad={props.moreToLoad}
        onAddParticipant={props.onAddParticipant}
        onDeleteMessage={props.onDeleteMessage}
        onEditMessage={props.onEditMessage}
        onLoadAttachment={props.onLoadAttachment}
        onLoadMoreMessages={props.onLoadMoreMessages}
        onOpenInFileUI={props.onOpenInFileUI}
        onOpenInPopup={props.onOpenInPopup}
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
    </Box>
  )
}

export default Conversation
