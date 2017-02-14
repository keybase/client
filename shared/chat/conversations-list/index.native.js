// @flow
import React from 'react'
import {Text, MultiAvatar, Icon, Usernames, Markdown, Box, ClickableBox, NativeScrollView} from '../../common-adapters/index.native'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {shouldUpdate} from 'recompose'

import type {Props, RowProps} from './'

const AddNewRow = ({onNewChat}: {onNewChat: () => void}) => (
  <Box
    style={{...globalStyles.flexBoxRow, alignItems: 'center', flexShrink: 0, justifyContent: 'center', minHeight: 48}}>
    <ClickableBox style={{...globalStyles.flexBoxColumn}} onClick={onNewChat}>
      <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', justifyContent: 'center'}}>
        <Icon type='iconfont-new' style={{color: globalColors.blue, marginRight: 9}} />
        <Text type='BodyBigLink'>New chat</Text>
      </Box>
    </ClickableBox>
  </Box>
)

// All this complexity isn't great but the current implementation of avatar forces us to juggle all these colors and
// forces us to explicitly choose undefined/the background/ etc. This can be cleaned up when avatar is simplified
function rowBorderColor (idx: number, isLastParticipant: boolean, backgroundColor: string) {
  // Only color the foreground items
  if (isLastParticipant) {
    return undefined
  }

  // We don't want a border if we're a single avatar
  return !idx && isLastParticipant ? undefined : backgroundColor
}

const Avatars = ({participants, youNeedToRekey, participantNeedToRekey, isMuted, hasUnread, isSelected, backgroundColor}) => {
  const avatarCount = Math.min(2, participants.count())

  let icon
  if (isMuted) {
    icon = <Icon type={isSelected ? 'icon-shh-active-16' : 'icon-shh-16'} style={avatarMutedIconStyle} />
  } else if (participantNeedToRekey || youNeedToRekey) {
    icon = <Icon type={isSelected ? 'icon-chat-addon-lock-active-8' : 'icon-chat-addon-lock-8'} style={avatarLockIconStyle} />
  }

  const avatarProps = participants.slice(0, 2).map((username, idx) => ({
    backgroundColor,
    borderColor: rowBorderColor(idx, idx === (avatarCount - 1), backgroundColor),
    size: 24,
    style: {
      opacity: youNeedToRekey || participantNeedToRekey ? 0.4 : 1,
    },
    username,
  })).toArray()

  return (
    <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', flex: 1, justifyContent: 'flex-start', maxWidth: 48, paddingLeft: 4}}>
      <MultiAvatar singleSize={32} multiSize={24} avatarProps={avatarProps} />
      {icon}
    </Box>
  )
}

const TopLine = ({hasUnread, showBold, participants, subColor, timestamp, usernameColor, commaColor}) => {
  const boldOverride = showBold ? globalStyles.fontBold : null
  return (
    <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', maxHeight: 17, minHeight: 17}}>
      <Box style={{...globalStyles.flexBoxRow, flex: 1, height: 17, position: 'relative'}}>
        <Box style={{...globalStyles.flexBoxColumn, bottom: 0, justifyContent: 'flex-start', left: 0, position: 'absolute', right: 0, top: 0}}>
          <Usernames
            inline={true}
            type='BodySemibold'
            style={{...boldOverride, color: usernameColor}}
            commaColor={commaColor}
            containerStyle={{color: usernameColor, paddingRight: 7}}
            users={participants.map(p => ({username: p})).toArray()}
            title={participants.join(', ')} />
        </Box>
      </Box>
      <Text type='BodySmall' style={{...boldOverride, color: subColor, lineHeight: 17}}>{timestamp}</Text>
      {hasUnread && <Box style={unreadDotStyle} />}
    </Box>
  )
}

const BottomLine = ({participantNeedToRekey, youNeedToRekey, isMuted, showBold, subColor, snippet}) => {
  const boldOverride = showBold ? globalStyles.fontBold : null

  let content

  if (youNeedToRekey) {
    content = <Text type='BodySmallSemibold' backgroundMode='Terminal' style={{alignSelf: 'flex-start', backgroundColor: globalColors.red, borderRadius: 2, color: globalColors.white, fontSize: 10, paddingLeft: 2, paddingRight: 2}}>REKEY NEEDED</Text>
  } else if (participantNeedToRekey) {
    content = <Text type='BodySmall' backgroundMode='Terminal' style={{color: subColor}}>Waiting for participants to rekey</Text>
  } else if (snippet && !isMuted) {
    content = <Markdown preview={true} style={{...boldOverride, color: subColor, fontSize: 11, lineHeight: 15, minHeight: 15}}>{snippet}</Markdown>
  } else {
    return null
  }

  return (
    <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', maxHeight: 17, minHeight: 17, position: 'relative'}}>
      <Box style={{...globalStyles.flexBoxColumn, bottom: 0, justifyContent: 'flex-start', left: 0, position: 'absolute', right: 0, top: 0}}>
        {content}
      </Box>
    </Box>
  )
}

const _Row = (props: RowProps) => {
  return (
    <Box
      onClick={() => props.onSelectConversation(props.conversationIDKey)}
      style={{...rowContainerStyle, backgroundColor: props.backgroundColor}}
      title={`${props.unreadCount} unread`}
    >
      <Avatars
        hasUnread={props.hasUnread}
        isMuted={props.isMuted}
        isSelected={props.isSelected}
        participantNeedToRekey={props.participantNeedToRekey}
        participants={props.participants}
        youNeedToRekey={props.youNeedToRekey}
      />
      <Box style={{...globalStyles.flexBoxColumn, ...conversationRowStyle}}>
        <TopLine
          commaColor={props.commaColor}
          hasUnread={props.hasUnread}
          participants={props.participants}
          showBold={props.showBold}
          subColor={props.subColor}
          timestamp={props.timestamp}
          usernameColor={props.usernameColor}
        />
        <BottomLine
          isMuted={props.isMuted}
          participantNeedToRekey={props.participantNeedToRekey}
          showBold={props.showBold}
          snippet={props.snippet}
          subColor={props.subColor}
          youNeedToRekey={props.youNeedToRekey}
        />
      </Box>
    </Box>
  )
}

const Row = shouldUpdate((props: RowProps, nextProps: RowProps) => {
  const different =
    props.conversationIDKey !== nextProps.conversationIDKey ||
    props.unreadCount !== nextProps.unreadCount ||
    props.isSelected !== nextProps.isSelected ||
    props.isMuted !== nextProps.isMuted ||
    props.youNeedToRekey !== nextProps.youNeedToRekey ||
    props.participantNeedToRekey !== nextProps.participantNeedToRekey ||
    props.timestamp !== nextProps.timestamp ||
    props.snippet !== nextProps.snippet ||
    !props.participants.equals(nextProps.participants)
  return different
})(_Row)

const ConversationList = (props: Props) => (
  <Box style={{...globalStyles.flexBoxColumn, backgroundColor: globalColors.darkBlue4, flex: 1}}>
    <AddNewRow {...props} />
    <NativeScrollView style={{...globalStyles.flexBoxColumn, flex: 1}}>
      {props.rows.map(rowProps => <Row {...rowProps} key={rowProps.conversationIDKey} />)}
    </NativeScrollView>
  </Box>
)

const unreadDotStyle = {
  backgroundColor: globalColors.orange,
  borderRadius: 3,
  height: 6,
  marginLeft: 4,
  width: 6,
}

const avatarMutedIconStyle = {
  marginLeft: -globalMargins.small,
  marginTop: 20,
  zIndex: 1,
}

const avatarLockIconStyle = {
  marginLeft: -10,
  marginTop: 20,
  zIndex: 1,
}

const conversationRowStyle = {
  flex: 1,
  justifyContent: 'center',
  paddingRight: 8,
}

const rowContainerStyle = {
  ...globalStyles.flexBoxRow,
  ...globalStyles.clickable,
  flexShrink: 0,
  maxHeight: 48,
  minHeight: 48,
}

export default ConversationList
