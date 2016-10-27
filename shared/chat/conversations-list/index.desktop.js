// @flow
import React from 'react'
import {Box, Text, Avatar} from '../../common-adapters'
import {globalStyles, globalColors} from '../../styles'

import type {Props} from './'

const ConversationList = ({inbox, onSelectConversation}: Props) => (
  <Box style={{...globalStyles.flexBoxColumn, backgroundColor: globalColors.darkBlue4, width: 240}}>
    {inbox.map(conversation => (
      <Box
        onClick={() => onSelectConversation(conversation.conversationIDKey)}
        style={{...globalStyles.flexBoxRow, padding: 4, borderBottom: 'solid 1px white'}}
        key={conversation.conversationIDKey}>
        <Avatar size={32} backgroundColor={globalColors.darkBlue4} username={undefined} />
        <Box style={{...globalStyles.flexBoxColumn, flex: 1, marginLeft: 12}}>
          <Text backgroundMode='Terminal' type='Body'>{conversation.participants.join(', ')}</Text>
          <Text backgroundMode='Terminal' type='BodySmall'>{conversation.snippet}</Text>
        </Box>
        <Text backgroundMode='Terminal' type='BodySmall' style={{marginRight: 4}}>{conversation.time}</Text>
      </Box>
    )).toJS()}
  </Box>
)

export default ConversationList
