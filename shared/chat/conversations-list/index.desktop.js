// @flow
import React from 'react'
import moment from 'moment'
import {Box, Text, Avatar} from '../../common-adapters'
import {globalStyles, globalColors} from '../../styles'

import type {Props} from './'

function _timestamp (time: number): string {
  const m = moment(time)
  const today = moment().clone().startOf('day')
  const weekOld = today.clone().subtract(7, 'days')

  if (m.isSame(today, 'd')) {
    return m.format('h:mm A')
  } else if (m.isAfter(weekOld)) {
    return m.format('dddd')
  }

  return m.format('MMM D')
}

const ConversationList = ({inbox, onSelectConversation, selectedConversation}: Props) => (
  <Box style={{...globalStyles.flexBoxColumn, backgroundColor: globalColors.darkBlue4, width: 240}}>
    {inbox.map(conversation => (
      <Box
        onClick={() => onSelectConversation(conversation.get('conversationIDKey'))}
        title={`${conversation.get('unreadCount')} unread`}
        style={{
          ...containerStyle,
          backgroundColor: selectedConversation === conversation.get('conversationIDKey') ? globalColors.darkBlue2 : globalColors.transparent,
        }}
        key={conversation.get('conversationIDKey')}>
        <Avatar
          size={32}
          backgroundColor={globalColors.darkBlue4}
          username={conversation.get('participants').first()}
          borderColor={conversation.get('unreadCount') ? globalColors.orange : undefined}
        />
        <Box style={{...globalStyles.flexBoxColumn, flex: 1, marginLeft: 12, position: 'relative'}}>
          <Box style={{position: 'absolute', top: 0, bottom: 0, left: 0, right: 0}}>
            <Text backgroundMode='Terminal' type='Body' style={noWrapStyle}>{conversation.get('participants').join(', ')}</Text>
            <Text backgroundMode='Terminal' type='BodySmall' style={noWrapStyle}>{conversation.get('snippet')}</Text>
          </Box>
        </Box>
        <Text backgroundMode='Terminal' type='BodySmall' style={{marginRight: 4}}>{_timestamp(conversation.get('time'))}</Text>
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

const containerStyle = {
  ...globalStyles.flexBoxRow,
  ...globalStyles.clickable,
  padding: 4,
  borderBottom: `solid 1px ${globalColors.black_10}`,
}

export default ConversationList
