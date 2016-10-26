// @flow
import React from 'react'
import {Box, Text} from '../../common-adapters'
import {globalStyles, globalColors} from '../../styles'

import type {Props} from './'

const ConversationList = ({inbox, onSelectConversation}: Props) => (
  <Box style={{...globalStyles.flexBoxColumn, flow: 1, backgroundColor: globalColors.darkBlue4, width: 240}}>
    {inbox.map(conversation => {
      return <Text
        onClick={() => onSelectConversation(conversation.conversationIDKey)}
        style={{padding: 8, borderBottom: 'solid 1px white'}}
        backgroundMode='Terminal'
        key={conversation.conversationIDKey}
        type='Body'>
        {conversation.participants.join(', ')}</Text>
    }).toJS()}
  </Box>
)

export default ConversationList
