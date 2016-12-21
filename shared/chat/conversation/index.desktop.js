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
      <Header {...props} />
      <List
        messages={props.messages}
        selectedConversation={props.selectedConversation}
        onLoadMoreMessages={props.onLoadMoreMessages}
        onEditMessage={props.onEditMessage}
        onDeleteMessage={props.onDeleteMessage}
        moreToLoad={props.moreToLoad}
        firstNewMessageID={props.firstNewMessageID}
        onLoadAttachment={props.onLoadAttachment}
        onOpenInFileUI={props.onOpenInFileUI}
        validated={props.validated}
        sidePanelOpen={props.sidePanelOpen}
        participants={props.participants}
        onShowProfile={props.onShowProfile}
        metaData={props.metaData}
        onAddParticipant={props.onAddParticipant}
      />
      {banner}
      <Input
        emojiPickerOpen={props.emojiPickerOpen}
        selectedConversation={props.selectedConversation}
        isLoading={props.isLoading}
        inputText={props.inputText}
        setInputText={props.setInputText}
      />
    </Box>
  )
}

export default Conversation
