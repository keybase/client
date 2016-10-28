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
        <Box style={{...globalStyles.flexBoxColumn, flex: 1, marginLeft: 12, position: 'relative'}}>
          <Box style={{position: 'absolute', top: 0, bottom: 0, left: 0, right: 0}}>
            <Text backgroundMode='Terminal' type='Body' style={noWrapStyle}>{conversation.participants.join(', ')}</Text>
            <Text backgroundMode='Terminal' type='BodySmall' style={noWrapStyle}>{conversation.snippet}</Text>
          </Box>
        </Box>
        <Text backgroundMode='Terminal' type='BodySmall' style={{marginRight: 4}}>{conversation.time}</Text>
      </Box>
    )).toJS()}
  </Box>
)

const noWrapStyle = {
  whiteSpace: 'nowrap',
  display: 'block',
  width: '100%',
  textOverflow: 'ellipsis',
  overflow: 'hidden',
}

export default ConversationList
