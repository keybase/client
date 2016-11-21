// @flow
import React from 'react'
import moment from 'moment'
import {Box, Text, Avatar, Icon, Usernames} from '../../common-adapters'
import {globalStyles, globalColors} from '../../styles'

import type {Props} from './'

function _timestamp (time: number, nowOverride?: number): string {
  const m = moment(time)
  const now = nowOverride ? moment(nowOverride) : moment()
  const today = now.clone().startOf('day')
  const weekOld = today.clone().subtract(7, 'days')

  if (m.isSame(today, 'd')) {
    return m.format('h:mm A')
  } else if (m.isAfter(weekOld)) {
    return m.format('dddd')
  }

  return m.format('MMM D')
}

const ConversationList = ({inbox, onSelectConversation, selectedConversation, onNewChat, nowOverride}: Props) => (
  <Box style={{...globalStyles.flexBoxColumn, backgroundColor: globalColors.darkBlue4, width: 240}}>
    <Box
      style={{...globalStyles.flexBoxRow, ...globalStyles.clickable, height: 48, justifyContent: 'center', alignItems: 'center'}}
      onClick={() => onNewChat()}>
      <Icon type='iconfont-new' style={{color: globalColors.blue, marginRight: 9}} />
      <Text type='BodyBigLink'>New chat</Text>
    </Box>
    {inbox.map(conversation => {
      // Get participants (don't include ourself) unless the only participant is ourself
      let participants = conversation.get('participants').filter(p => !p.you)
      if (participants.count() === 0) participants = conversation.get('participants')

      return (
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
            username={participants.first().username}
            borderColor={conversation.get('unreadCount') ? globalColors.orange : undefined}
          />
          <Box style={{...globalStyles.flexBoxColumn, flex: 1, marginLeft: 12, position: 'relative'}}>
            <Box style={{...globalStyles.flexBoxColumn, position: 'absolute', top: 0, bottom: 0, left: 0, right: 0}}>
              <Usernames inline={true} type='Body' backgroundMode='Terminal' users={participants} title={participants.map(p => p.username).join(', ')} />
              <Text backgroundMode='Terminal' type='BodySmall' style={noWrapStyle}>{conversation.get('snippet')}</Text>
            </Box>
          </Box>
          <Text backgroundMode='Terminal' type='BodySmall' style={{marginRight: 4}}>{_timestamp(conversation.get('time'), nowOverride)}</Text>
        </Box>
      )
    })}
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
