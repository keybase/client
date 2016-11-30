// @flow
import React from 'react'
import moment from 'moment'
import {Box, Text, MultiAvatar, Icon, Usernames} from '../../common-adapters'
import {globalStyles, globalColors} from '../../styles'
import {participantFilter} from '../../constants/chat'

import type {Props} from './'
import type {InboxState} from '../../constants/chat'

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

const AddNewRow = ({onNewChat}: Props) => (
  <Box
    style={{...globalStyles.flexBoxRow, ...globalStyles.clickable, minHeight: 48, justifyContent: 'center', alignItems: 'center', flexShrink: 0}}
    onClick={() => onNewChat()}>
    <Icon type='iconfont-new' style={{color: globalColors.blue, marginRight: 9}} />
    <Text type='BodyBigLink'>New chat</Text>
  </Box>
)

const rowBorderColor = (idx: number, lastParticipantIndex: number, hasUnread: boolean, isSelected: boolean) => {
  if (idx === lastParticipantIndex) {
    if (lastParticipantIndex === 1) {
      if (hasUnread) {
        return globalColors.orange
      }
      return isSelected ? globalColors.darkBlue2 : globalColors.darkBlue4
    }
    return hasUnread ? globalColors.orange : undefined
  }

  return undefined
}

const Row = ({onSelectConversation, selectedConversation, onNewChat, nowOverride, conversation}: Props & {conversation: InboxState}) => {
  const participants = participantFilter(conversation.get('participants'))
  const isSelected = selectedConversation === conversation.get('conversationIDKey')
  // $FlowIssue
  const avatarProps = participants.slice(0, 2).map((p, idx) => ({
    backgroundColor: globalColors.darkBlue4,
    username: p.username,
    borderColor: rowBorderColor(idx, Math.min(2, participants.count()) - 1, !!conversation.get('unreadCount'), isSelected),
  })).toArray()
  const snippet = conversation.get('snippet')
  return <Box
    onClick={() => onSelectConversation(conversation.get('conversationIDKey'))}
    title={`${conversation.get('unreadCount')} unread`}
    style={{
      ...rowContainerStyle,
      backgroundColor: isSelected ? globalColors.darkBlue2 : globalColors.transparent,
    }}>
    <MultiAvatar
      singleSize={32}
      multiSize={24}
      avatarProps={avatarProps} />
    {conversation.get('muted') && <p>MUTED</p>}
    <Box style={{...globalStyles.flexBoxColumn, flex: 1, marginLeft: 12, position: 'relative'}}>
      <Box style={{...globalStyles.flexBoxColumn, position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center'}}>
        <Usernames inline={true} type='Body' backgroundMode='Terminal' users={participants.toArray()} title={participants.map(p => p.username).join(', ')} />
        {snippet && <Text backgroundMode='Terminal' type='BodySmall' style={noWrapStyle}>{snippet}</Text>}
      </Box>
    </Box>
    <Text backgroundMode='Terminal' type='BodySmall' style={{marginRight: 4}}>{_timestamp(conversation.get('time'), nowOverride)}</Text>
  </Box>
}

const ConversationList = (props: Props) => (
  <Box style={containerStyle}>
    <AddNewRow {...props} />
    <Box style={scrollableStyle}>
      {props.inbox.map(conversation => <Row {...props} key={conversation.get('conversationIDKey')} conversation={conversation} />)}
    </Box>
  </Box>
)

const containerStyle = {
    ...globalStyles.flexBoxColumn,
   backgroundColor: globalColors.darkBlue4,
   maxWidth: 240,
   flex: 1,
}

const scrollableStyle = {
    ...globalStyles.flexBoxColumn,
   flex: 1,
   overflowY: 'auto',
}

const noWrapStyle = {
  whiteSpace: 'nowrap',
  display: 'block',
  width: '100%',
  textOverflow: 'ellipsis',
  overflow: 'hidden',
}

const rowContainerStyle = {
  ...globalStyles.flexBoxRow,
  ...globalStyles.clickable,
  flexShrink: 0,
  minHeight: 40,
  maxHeight: 40,
  padding: 4,
  borderBottom: `solid 1px ${globalColors.black_10}`,
}

export default ConversationList
