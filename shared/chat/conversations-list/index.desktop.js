// @flow
import React from 'react'
import {Box, Text, MultiAvatar, Icon, Usernames} from '../../common-adapters'
import {globalStyles, globalColors} from '../../styles'
import {participantFilter} from '../../constants/chat'
import {formatTimeForConversationList} from '../../util/timestamp'

import type {Props} from './'
import type {InboxState} from '../../constants/chat'

const AddNewRow = ({onNewChat}: Props) => (
  <Box
    style={{...globalStyles.flexBoxRow, ...globalStyles.clickable, minHeight: 48, justifyContent: 'center', alignItems: 'center', flexShrink: 0}}
    onClick={() => onNewChat()}>
    <Icon type='iconfont-new' style={{color: globalColors.blue, marginRight: 9}} />
    <Text type='BodyBigLink'>New chat</Text>
  </Box>
)

const rowBorderColor = (idx: number, lastParticipantIndex: number, hasUnread: boolean, isSelected: boolean) => {
  // Not the most recent? Don't color
  if (idx !== lastParticipantIndex) {
    return undefined
  }

  // Only one avatar?
  if (lastParticipantIndex === 0) {
    return hasUnread ? globalColors.orange : undefined
  }

  // Multiple avatars?
  if (hasUnread) {
    return globalColors.orange
  }

  return isSelected ? globalColors.darkBlue2 : globalColors.darkBlue4
}

const Row = ({onSelectConversation, selectedConversation, onNewChat, nowOverride, conversation}: Props & {conversation: InboxState}) => {
  const participants = participantFilter(conversation.get('participants'))
  const isSelected = selectedConversation === conversation.get('conversationIDKey')
  const isMuted = conversation.get('muted')
  const hasUnread = !!conversation.get('unreadCount')
  const avatarProps = participants.slice(0, 2).map((p, idx) => ({
    backgroundColor: globalColors.darkBlue4,
    username: p.username,
    borderColor: rowBorderColor(idx, Math.min(2, participants.count()) - 1, hasUnread, isSelected),
    size: 24,
  })).toArray().reverse()
  const snippet = conversation.get('snippet')
  const subColor = (isSelected || hasUnread) ? globalColors.white : globalColors.blue3_40
  const backgroundColor = isSelected ? globalColors.darkBlue2 : hasUnread ? globalColors.darkBlue : globalColors.transparent
  const boldOverride = hasUnread ? globalStyles.fontBold : null
  return (
    <Box
      onClick={() => onSelectConversation(conversation.get('conversationIDKey'))}
      title={`${conversation.get('unreadCount')} unread`}
      style={{...rowContainerStyle, backgroundColor}}>
      <Box style={{...globalStyles.flexBoxRow, flex: 1, maxWidth: 48, alignItems: 'center', justifyContent: 'flex-start', paddingLeft: 4}}>
        <MultiAvatar singleSize={32} multiSize={24} avatarProps={avatarProps} />
        {isMuted && <Icon type='iconfont-shh' style={shhStyle} />}
      </Box>
      <Box style={{...globalStyles.flexBoxRow, flex: 1, borderBottom: `solid 1px ${globalColors.black_10}`, paddingRight: 8, paddingTop: 4, paddingBottom: 4}}>
        <Box style={{...globalStyles.flexBoxColumn, flex: 1, position: 'relative'}}>
          <Box style={{...globalStyles.flexBoxColumn, position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center'}}>
            <Usernames
              inline={true}
              type='BodySemibold'
              style={{...boldOverride, color: isMuted ? globalColors.blue3_40 : globalColors.white}}
              containerStyle={{color: isMuted ? globalColors.blue3_40 : globalColors.white, paddingRight: 7}}
              users={participants.toArray()}
              title={participants.map(p => p.username).join(', ')} />
            {snippet && !isMuted && <Text type='BodySmall' style={{...noWrapStyle, ...boldOverride, color: subColor, minHeight: 15}}>{snippet}</Text>}
          </Box>
        </Box>
        <Text type='BodySmall' style={{...boldOverride, marginRight: 4, alignSelf: isMuted ? 'center' : 'flex-start', color: subColor}}>{formatTimeForConversationList(conversation.get('time'), nowOverride)}</Text>
      </Box>
    </Box>
  )
}

const shhStyle = {
  color: globalColors.darkBlue2,
  alignSelf: 'flex-end',
  marginLeft: -5,
  marginTop: 5,
  // TODO remove this when we get the updated icon w/ the stroke
  textShadow: `
    -1px -1px 0 ${globalColors.darkBlue4},
     1px -1px 0 ${globalColors.darkBlue4},
    -1px  1px 0 ${globalColors.darkBlue4},
     1px  1px 0 ${globalColors.darkBlue4},
    -2px -2px 0 ${globalColors.darkBlue4},
     2px -2px 0 ${globalColors.darkBlue4},
    -2px  2px 0 ${globalColors.darkBlue4},
     2px  2px 0 ${globalColors.darkBlue4}`,
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
  display: 'block',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  width: '100%',
}

const rowContainerStyle = {
  ...globalStyles.flexBoxRow,
  ...globalStyles.clickable,
  flexShrink: 0,
  minHeight: 40,
  maxHeight: 40,
}

export default ConversationList
