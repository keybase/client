// @flow
import React from 'react'
import {Map} from 'immutable'
import {Text, MultiAvatar, Icon, Usernames, Markdown} from '../../common-adapters'
import {formatTimeForConversationList} from '../../util/timestamp'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {participantFilter} from '../../constants/chat'
import {shouldUpdate} from 'recompose'

import type {Props} from './'
import type {InboxState, RekeyInfo, ConversationIDKey} from '../../constants/chat'

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

// All this complexity isn't great but the current implementation of avatar forces us to juggle all these colors and
// forces us to explicitly choose undefined/the background/ etc. This can be cleaned up when avatar is simplified
function rowBorderColor (idx: number, isLastParticipant: boolean, hasUnread: boolean, isSelected: boolean) {
  // Only color the foreground items
  if (isLastParticipant) {
    return undefined
  }

  const rowBackground = rowBackgroundColor(hasUnread, isSelected)
  // We don't want a border if we're a single avatar
  return !idx && isLastParticipant ? undefined : rowBackground
}

type RowProps = Props & {conversation: InboxState, unreadCount: number, rekeyInfos: Map<ConversationIDKey, RekeyInfo>}

const Avatars = ({participants, youNeedToRekey, participantNeedToRekey, isMuted, hasUnread, isSelected}) => {
  const avatarCount = Math.min(2, participants.count())

  let icon
  if (isMuted) {
    icon = <Icon type={isSelected ? 'icon-shh-active-16' : 'icon-shh-16'} style={avatarIconStyle} />
  } else if (participantNeedToRekey || youNeedToRekey) {
    icon = <Icon type='icon-folder-private-32-addon-locked' style={avatarIconStyle} />
  }

  const avatarProps = participants.slice(0, 2).map((username, idx) => ({
    backgroundColor: rowBackgroundColor(hasUnread, isSelected),
    borderColor: rowBorderColor(idx, idx === (avatarCount - 1), hasUnread, isSelected),
    size: 24,
    style: {
      opacity: youNeedToRekey || participantNeedToRekey ? 0.4 : 1,
    },
    username,
  })).toArray()

  return (
    <div style={{...globalStyles.flexBoxRow, alignItems: 'center', flex: 1, justifyContent: 'flex-start', maxWidth: 48, paddingLeft: 4}}>
      <MultiAvatar singleSize={32} multiSize={24} avatarProps={avatarProps} />
      {icon}
    </div>
  )
}

const TopLine = ({isSelected, hasUnread, boldOverride, participants, subColor, conversation, nowOverride}) => {
  const usernameColor = isSelected ? globalColors.black_75 : hasUnread ? globalColors.white : globalColors.blue3_60
  const commaColor = isSelected ? globalColors.black_60 : hasUnread ? globalColors.white_75 : globalColors.blue3_40

  return (
    <div style={{...globalStyles.flexBoxRow, alignItems: 'center', maxHeight: 17, minHeight: 17}}>
      <div style={{...globalStyles.flexBoxRow, flex: 1, height: 17, position: 'relative'}}>
        <div style={{...globalStyles.flexBoxColumn, bottom: 0, justifyContent: 'flex-start', left: 0, position: 'absolute', right: 0, top: 0}}>
          <Usernames
            inline={true}
            type='BodySemibold'
            style={{...boldOverride, color: usernameColor}}
            commaColor={commaColor}
            containerStyle={{color: usernameColor, paddingRight: 7}}
            users={participants.map(p => ({username: p})).toArray()}
            title={participants.join(', ')} />
        </div>
      </div>
      <Text type='BodySmall' style={{...boldOverride, color: subColor, lineHeight: '17px'}}>{formatTimeForConversationList(conversation.get('time'), nowOverride)}</Text>
      {hasUnread && <div style={unreadDotStyle} />}
    </div>
  )
}

const BottomLine = ({participantNeedToRekey, isMuted, boldOverride, subColor, conversation}) => {
  const snippet = conversation.get('snippet')
  let content

  if (participantNeedToRekey) {
    content = <Text type='BodySmall' backgroundMode='Terminal' style={{color: subColor}}>Waiting for participants to rekey</Text>
  } else if (snippet && !isMuted) {
    content = <Markdown preview={true} style={{...noWrapStyle, ...boldOverride, color: subColor, fontSize: 11, lineHeight: '15px', minHeight: 15}}>{snippet}</Markdown>
  } else {
    return null
  }

  return (
    <div style={{...globalStyles.flexBoxRow, alignItems: 'center', maxHeight: 17, minHeight: 17, position: 'relative'}}>
      <div style={{...globalStyles.flexBoxColumn, bottom: 0, justifyContent: 'flex-start', left: 0, position: 'absolute', right: 0, top: 0}}>
        {content}
      </div>
    </div>
  )
}

const _Row = ({onSelectConversation, selectedConversation, onNewChat, nowOverride, conversation, unreadCount, you, rekeyInfos}: RowProps) => {
  const participants = participantFilter(conversation.get('participants'), you)
  const conversationIDKey = conversation.get('conversationIDKey')
  const isSelected = selectedConversation === conversationIDKey
  const isMuted = conversation.get('muted')
  const hasUnread = !!unreadCount
  const rekeyInfo = selectedConversation && rekeyInfos.get(conversationIDKey)
  const youNeedToRekey = rekeyInfo && !rekeyInfo.get('rekeyParticipants').count() && rekeyInfo.get('youCanRekey')
  const participantNeedToRekey = rekeyInfo && rekeyInfo.get('rekeyParticipants').count()

  const subColor = isSelected ? globalColors.black_40 : hasUnread ? globalColors.white : globalColors.blue3_40
  const boldOverride = !isSelected && hasUnread ? globalStyles.fontBold : null

  return (
    <div
      onClick={() => onSelectConversation(conversationIDKey)}
      title={`${unreadCount} unread`}
      style={{...rowContainerStyle, backgroundColor: rowBackgroundColor(hasUnread, isSelected)}}>
      <Avatars
        hasUnread={hasUnread}
        isMuted={isMuted}
        isSelected={isSelected}
        participantNeedToRekey={participantNeedToRekey}
        participants={participants}
        youNeedToRekey={youNeedToRekey} />
      <div style={{...globalStyles.flexBoxColumn, ...conversationRowStyle, borderBottom: (!isSelected && !hasUnread) ? `solid 1px ${globalColors.black_10}` : 'solid 1px transparent'}}>
        <TopLine
          hasUnread={hasUnread}
          conversation={conversation}
          boldOverride={boldOverride}
          participants={participants}
          nowOverride={nowOverride}
          subColor={subColor}
          isSelected={isSelected} />
        <BottomLine
          participantNeedToRekey={participantNeedToRekey}
          youNeedToRekey={youNeedToRekey}
          conversation={conversation}
          subColor={subColor}
          boldOverride={boldOverride}
          isMuted={isMuted} />
      </div>
    </div>
  )
}

const unreadDotStyle = {
  backgroundColor: globalColors.orange,
  borderRadius: 3,
  height: 6,
  marginLeft: 4,
  width: 6,
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

  if (props.unreadCount !== nextProps.unreadCount) {
    return true
  }

  if (props.rekeyInfos !== nextProps.rekeyInfos) {
    return true
  }

  return false
})(_Row)

const avatarIconStyle = {
  marginLeft: -globalMargins.small,
  marginTop: 20,
  zIndex: 1,
}

const conversationRowStyle = {
  flex: 1,
  justifyContent: 'center',
  paddingRight: 8,
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
