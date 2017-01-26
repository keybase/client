// @flow
import React from 'react'
import {Text, MultiAvatar, Icon, Usernames, Markdown} from '../../common-adapters'
import {formatTimeForConversationList} from '../../util/timestamp'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {participantFilter} from '../../constants/chat'
import {shouldUpdate} from 'recompose'

import type {Props} from './'
import type {InboxState} from '../../constants/chat'

const AddNewRow = ({onNewChat}: Props) => (
  <div
    style={{...globalStyles.flexBoxRow, alignItems: 'center', flexShrink: 0, justifyContent: 'center', minHeight: 48}}>
    <div style={{...globalStyles.flexBoxRow, ...globalStyles.clickable, alignItems: 'center', justifyContent: 'center'}} onClick={onNewChat}>
      <Icon type='iconfont-new' style={{color: globalColors.blue, marginRight: 9}} />
      <Text type='BodyBigLink'>New chat</Text>
    </div>
  </div>
)

function rowBackgroundColor (hasUnread: boolean, isSelected: boolean) {
  return isSelected ? globalColors.white : hasUnread ? globalColors.darkBlue : globalColors.darkBlue4
}

// All this complexity isn't great but the current implmentation of avatar forces us to juggle all these colors and
// forces us to explicitly choose undefined/the background/ etc. This can be cleaned up when avatar is simplified
function rowBorderColor (idx: number, lastParticipantIndex: number, hasUnread: boolean, isSelected: boolean) {
  // Not the most recent? Don't color
  if (idx === lastParticipantIndex) {
    return undefined
  }

  const rowBackground = rowBackgroundColor(hasUnread, isSelected)
  return (rowBackground === globalColors.darkBlue4) && !lastParticipantIndex ? undefined : rowBackground
}

type RowProps = Props & {conversation: InboxState}

const _Row = ({onSelectConversation, selectedConversation, onNewChat, nowOverride, conversation, you}: RowProps) => {
  const participants = participantFilter(conversation.get('participants'), you)
  const isSelected = selectedConversation === conversation.get('conversationIDKey')
  const isMuted = conversation.get('muted')
  const hasUnread = !!conversation.get('unreadCount')
  const avatarProps = participants.slice(0, 2).map((username, idx) => ({
    backgroundColor: rowBackgroundColor(hasUnread, isSelected),
    borderColor: rowBorderColor(idx, Math.min(2, participants.count()) - 1, hasUnread, isSelected),
    size: 24,
    username,
  })).toArray()
  const snippet = conversation.get('snippet')
  const subColor = isSelected ? globalColors.black_40 : hasUnread ? globalColors.white : globalColors.blue3_40
  const backgroundColor = rowBackgroundColor(hasUnread, isSelected)
  const usernameColor = isSelected ? globalColors.black_75 : hasUnread ? globalColors.white : globalColors.blue3_60
  const boldOverride = !isSelected && hasUnread ? globalStyles.fontBold : null
  const shhIconType = isSelected ? 'icon-shh-active-16' : 'icon-shh-16'
  const commaColor = isSelected ? globalColors.black_60 : hasUnread ? globalColors.white_75 : globalColors.blue3_40
  return (
    <div
      onClick={() => onSelectConversation(conversation.get('conversationIDKey'))}
      title={`${conversation.get('unreadCount')} unread`}
      style={{...rowContainerStyle, backgroundColor}}>
      <div style={{...globalStyles.flexBoxRow, alignItems: 'center', flex: 1, justifyContent: 'flex-start', maxWidth: 48, paddingLeft: 4}}>
        <MultiAvatar singleSize={32} multiSize={24} avatarProps={avatarProps} />
        {isMuted && <Icon type={shhIconType} style={shhStyle} />}
      </div>
      <div style={{...globalStyles.flexBoxRow, ...conversationRowStyle, borderBottom: (!isSelected && !hasUnread) ? `solid 1px ${globalColors.black_10}` : 'solid 1px transparent'}}>
        <div style={{...globalStyles.flexBoxColumn, flex: 1, position: 'relative'}}>
          <div style={{...globalStyles.flexBoxColumn, alignItems: 'center', bottom: 0, justifyContent: 'center', left: 0, position: 'absolute', right: 0, top: 0}}>
            <Usernames
              inline={true}
              type='BodySemibold'
              style={{...boldOverride, color: usernameColor}}
              commaColor={commaColor}
              containerStyle={{color: usernameColor, paddingRight: 7}}
              users={participants.map(p => ({username: p})).toArray()}
              title={participants.join(', ')} />
            {snippet && !isMuted && <Markdown preview={true} style={{...noWrapStyle, ...boldOverride, color: subColor, fontSize: 11, lineHeight: '15px', minHeight: 15}}>{snippet}</Markdown>}
          </div>
        </div>
        <Text type='BodySmall' style={{...boldOverride, alignSelf: (isMuted || !snippet) ? 'center' : 'flex-start', color: subColor, lineHeight: '17px', marginTop: globalMargins.xtiny}}>{formatTimeForConversationList(conversation.get('time'), nowOverride)}</Text>
        {hasUnread && <div style={unreadDotStyle} />}
      </div>
    </div>
  )
}

const unreadDotStyle = {
  backgroundColor: globalColors.orange,
  height: 6,
  width: 6,
  borderRadius: 3,
  marginLeft: 4,
  marginTop: 10,
}

const Row = shouldUpdate((props: RowProps, nextProps: RowProps) => {
  if (props.conversation !== nextProps.conversation) {
    return true
  }

  const oldIsSelected = props.selectedConversation === props.conversation.get('conversationIDKey')
  const newIsSelected = nextProps.selectedConversation === nextProps.conversation.get('conversationIDKey')

  if (oldIsSelected !== newIsSelected) {
    return true
  }

  return false
})(_Row)

const shhStyle = {
  marginLeft: -globalMargins.small,
  marginTop: 20,
  zIndex: 1,
}

const conversationRowStyle = {
  flex: 1,
  paddingBottom: 4,
  paddingRight: 8,
  paddingTop: 4,
}

const ConversationList = (props: Props) => (
  <div style={{...globalStyles.flexBoxRow, flex: 1}}>
    <div style={containerStyle}>
      <AddNewRow {...props} />
      <div style={scrollableStyle}>
        {props.inbox.map(conversation => <Row {...props} key={conversation.get('conversationIDKey')} conversation={conversation} />)}
      </div>
    </div>
    {props.children}
  </div>
)

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  backgroundColor: globalColors.darkBlue4,
  flex: 1,
  maxWidth: 240,
}

const scrollableStyle = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  overflowY: 'auto',
  willChange: 'transform',
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
  maxHeight: 48,
  minHeight: 48,
}

export default ConversationList
