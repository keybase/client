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
    style={{...globalStyles.flexBoxRow, ...globalStyles.clickable, minHeight: 48, justifyContent: 'center', alignItems: 'center', flexShrink: 0}}
    onClick={() => onNewChat()}>
    <Icon type='iconfont-new' style={{color: globalColors.blue, marginRight: 9}} />
    <Text type='BodyBigLink'>New chat</Text>
  </div>
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

  return isSelected ? globalColors.white : globalColors.darkBlue4
}

type RowProps = Props & {conversation: InboxState, unreadCount: number}

const _Row = ({onSelectConversation, selectedConversation, onNewChat, nowOverride, conversation, unreadCount, you}: RowProps) => {
  const participants = participantFilter(conversation.get('participants'), you)
  const isSelected = selectedConversation === conversation.get('conversationIDKey')
  const isMuted = conversation.get('muted')
  const hasUnread = !!unreadCount
  const avatarProps = participants.slice(0, 2).map((username, idx) => ({
    backgroundColor: isSelected ? globalColors.white : hasUnread ? globalColors.darkBlue : globalColors.darkBlue4,
    username,
    borderColor: rowBorderColor(idx, Math.min(2, participants.count()) - 1, hasUnread, isSelected),
    size: 24,
  })).toArray().reverse()
  const snippet = conversation.get('snippet')
  const subColor = isSelected ? globalColors.black_40 : hasUnread ? globalColors.white : globalColors.blue3_40
  const backgroundColor = isSelected ? globalColors.white : hasUnread ? globalColors.darkBlue : globalColors.transparent
  const usernameColor = isSelected ? globalColors.black_75 : hasUnread ? globalColors.white : globalColors.blue3_60
  const boldOverride = !isSelected && hasUnread ? globalStyles.fontBold : null
  const shhIconType = isSelected ? 'icon-shh-active-16' : 'icon-shh-16'
  const commaColor = isSelected ? globalColors.black_60 : hasUnread ? globalColors.white_75 : globalColors.blue3_40
  return (
    <div
      onClick={() => onSelectConversation(conversation.get('conversationIDKey'))}
      title={`${unreadCount} unread`}
      style={{...rowContainerStyle, backgroundColor}}>
      <div style={{...globalStyles.flexBoxRow, flex: 1, maxWidth: 48, alignItems: 'center', justifyContent: 'flex-start', paddingLeft: 4}}>
        <MultiAvatar singleSize={32} multiSize={24} avatarProps={avatarProps} />
        {isMuted && <Icon type={shhIconType} style={shhStyle} />}
      </div>
      <div style={{...globalStyles.flexBoxRow, ...conversationRowStyle, borderBottom: (!isSelected && !hasUnread) ? `solid 1px ${globalColors.black_10}` : 'solid 1px transparent'}}>
        <div style={{...globalStyles.flexBoxColumn, flex: 1, position: 'relative'}}>
          <div style={{...globalStyles.flexBoxColumn, position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center'}}>
            <Usernames
              inline={true}
              type='BodySemibold'
              style={{...boldOverride, color: usernameColor}}
              commaColor={commaColor}
              containerStyle={{color: usernameColor, paddingRight: 7}}
              users={participants.map(p => ({username: p})).toArray()}
              title={participants.join(', ')} />
            {snippet && !isMuted && <Markdown preview={true} style={{...noWrapStyle, ...boldOverride, color: subColor, minHeight: 15, fontSize: 11, lineHeight: '15px'}}>{snippet}</Markdown>}
          </div>
        </div>
        <Text type='BodySmall' style={{...boldOverride, marginRight: globalMargins.xtiny, marginTop: globalMargins.xtiny, alignSelf: (isMuted || !snippet) ? 'center' : 'flex-start', color: subColor, lineHeight: '17px'}}>{formatTimeForConversationList(conversation.get('time'), nowOverride)}</Text>
      </div>
    </div>
  )
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
  paddingRight: 8,
  paddingTop: 4,
  paddingBottom: 4,
}

const ConversationList = (props: Props) => (
  <div style={{...globalStyles.flexBoxRow, flex: 1}}>
    <div style={containerStyle}>
      <AddNewRow {...props} />
      <div style={scrollableStyle}>
        {props.inbox.map(conversation => <Row {...props} unreadCount={props.conversationUnreadCounts.get(conversation.get('conversationIDKey'))} key={conversation.get('conversationIDKey')} conversation={conversation} />)}
      </div>
    </div>
    {props.children}
  </div>
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
  willChange: 'transform',
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
  minHeight: 48,
  maxHeight: 48,
}

export default ConversationList
