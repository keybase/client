// @flow
import React, {PureComponent} from 'react'
import {Text, MultiAvatar, Icon, Usernames, Markdown, Box} from '../../../common-adapters'
import {globalStyles, globalColors, globalMargins, styleSheetCreate, collapseStyles} from '../../../styles'
import {isMobile} from '../../../constants/platform'

import {List} from 'immutable'
import type {Props} from '.'

// All this complexity isn't great but the current implementation of avatar forces us to juggle all these colors and
// forces us to explicitly choose undefined/the background/ etc. This can be cleaned up when avatar is simplified
function rowBorderColor(idx: number, isLastParticipant: boolean, backgroundColor: string) {
  // Only color the foreground items
  if (isLastParticipant) {
    return undefined
  }

  // We don't want a border if we're a single avatar
  return !idx && isLastParticipant ? undefined : backgroundColor
}

class TopLine
  extends PureComponent<
    void,
    {
      hasUnread: boolean,
      participants: List<string>,
      showBold: boolean,
      subColor: ?string,
      timestamp: ?string,
      usernameColor: ?string,
    },
    void
  > {
  render() {
    const {hasUnread, showBold, participants, subColor, timestamp, usernameColor} = this.props
    const height = isMobile ? 19 : 17
    const boldOverride = showBold ? globalStyles.fontBold : null
    return (
      <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', maxHeight: height, minHeight: height}}>
        <Box
          style={{
            ...globalStyles.flexBoxRow,
            flex: 1,
            maxHeight: height,
            minHeight: height,
            position: 'relative',
          }}
        >
          <Box
            style={{
              ...globalStyles.flexBoxColumn,
              bottom: 0,
              justifyContent: 'flex-start',
              left: 0,
              position: 'absolute',
              right: 0,
              top: 0,
            }}
          >
            <Usernames
              inline={true}
              plainText={true}
              type="BodySemibold"
              plainDivider={isMobile ? undefined : ',\u200a'}
              containerStyle={{...boldOverride, color: usernameColor, paddingRight: 7}}
              users={participants.map(p => ({username: p})).toArray()}
              title={participants.join(', ')}
            />
          </Box>
        </Box>
        <Text
          type="BodySmall"
          style={{...boldOverride, color: subColor, lineHeight: isMobile ? height : `${height}px`}}
        >
          {timestamp}
        </Text>
        {hasUnread && <Box style={unreadDotStyle} />}
      </Box>
    )
  }
}

class BottomLine
  extends PureComponent<
    void,
    {
      backgroundColor: ?string,
      participantNeedToRekey: boolean,
      showBold: boolean,
      snippet: ?string,
      subColor: ?string,
      youNeedToRekey: boolean,
    },
    void
  > {
  render() {
    const {participantNeedToRekey, youNeedToRekey, showBold, subColor, snippet, backgroundColor} = this.props
    let content

    if (youNeedToRekey) {
      content = (
        <Box
          style={{
            alignSelf: 'center',
            backgroundColor: globalColors.red,
            borderRadius: 2,
            paddingLeft: globalMargins.xtiny,
            paddingRight: globalMargins.xtiny,
          }}
        >
          <Text
            type="BodySmallSemibold"
            backgroundMode="Terminal"
            style={{
              color: globalColors.white,
              fontSize: 11,
              lineHeight: 14,
            }}
          >
            REKEY NEEDED
          </Text>
        </Box>
      )
    } else if (participantNeedToRekey) {
      content = (
        <Text type="BodySmall" backgroundMode="Terminal" style={{color: subColor}}>
          Waiting for participants to rekey
        </Text>
      )
    } else if (snippet) {
      const baseStyle = styles['bottomLine']

      let style

      if (subColor !== globalColors.black_40 || showBold) {
        style = collapseStyles([
          {
            color: subColor,
            ...(showBold ? globalStyles.fontBold : {}),
          },
          baseStyle,
        ])
      } else {
        style = baseStyle
      }

      content = (
        <Markdown preview={true} style={style}>
          {snippet}
        </Markdown>
      )
    } else {
      return null
    }

    const height = isMobile ? 16 : 17
    return (
      <Box
        style={{
          ...globalStyles.flexBoxRow,
          backgroundColor,
          flexGrow: 1,
          maxHeight: height,
          minHeight: height,
          position: 'relative',
        }}
      >
        <Box
          style={{
            ...globalStyles.flexBoxRow,
            alignItems: 'flex-start',
            bottom: 0,
            justifyContent: 'flex-start',
            left: 0,
            position: 'absolute',
            right: 0,
            top: 0,
          }}
        >
          {content}
        </Box>
      </Box>
    )
  }
}

const Avatars = ({
  participants,
  youNeedToRekey,
  participantNeedToRekey,
  isMuted,
  hasUnread,
  isSelected,
  backgroundColor,
}) => {
  const avatarCount = Math.min(2, participants.count())

  let icon
  if (isMuted) {
    icon = <Icon type={isSelected ? 'icon-shh-active-16' : 'icon-shh-16'} style={avatarMutedIconStyle} />
  } else if (participantNeedToRekey || youNeedToRekey) {
    icon = (
      <Icon
        type={isSelected ? 'icon-addon-lock-active-8' : 'icon-addon-lock-8'}
        style={avatarLockIconStyle}
      />
    )
  }

  const avatarProps = participants
    .slice(0, 2)
    .map((username, idx) => ({
      borderColor: rowBorderColor(idx, idx === avatarCount - 1, backgroundColor),
      loadingColor: globalColors.lightGrey,
      opacity: youNeedToRekey || participantNeedToRekey ? 0.4 : 1,
      size: 24,
      username,
    }))
    .toArray()

  return (
    <div
      style={{
        ...globalStyles.flexBoxRow,
        alignItems: 'center',
        flex: 1,
        justifyContent: 'flex-start',
        maxWidth: 48,
        paddingLeft: globalMargins.tiny,
      }}
    >
      <MultiAvatar singleSize={40} multiSize={32} avatarProps={avatarProps} />
      {icon}
    </div>
  )
}

const Row = (props: Props) => {
  return (
    <div
      onClick={() => props.onSelectConversation(props.conversationIDKey)}
      style={{...rowContainerStyle, backgroundColor: props.backgroundColor, marginRight: props.marginRight}}
      title={`${props.unreadCount} unread`}
    >
      <Avatars
        backgroundColor={props.backgroundColor}
        hasUnread={props.hasUnread}
        isMuted={props.isMuted}
        isSelected={props.isSelected}
        participantNeedToRekey={props.participantNeedToRekey}
        participants={props.participants}
        youNeedToRekey={props.youNeedToRekey}
      />
      <div
        style={{
          ...globalStyles.flexBoxColumn,
          ...conversationRowStyle,
        }}
      >
        <TopLine
          hasUnread={props.hasUnread}
          participants={props.participants}
          showBold={props.showBold}
          subColor={props.subColor}
          timestamp={props.timestamp}
          usernameColor={props.usernameColor}
        />
        <BottomLine
          backgroundColor={props.backgroundColor}
          participantNeedToRekey={props.participantNeedToRekey}
          showBold={props.showBold}
          snippet={props.snippet}
          subColor={props.subColor}
          youNeedToRekey={props.youNeedToRekey}
        />
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

const avatarMutedIconStyle = {
  marginLeft: -globalMargins.small,
  marginTop: 32,
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
  paddingLeft: 8,
  paddingRight: 8,
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
  maxHeight: 56,
  minHeight: 56,
}

const styles = styleSheetCreate({
  bottomLine: isMobile
    ? {
        color: globalColors.black_40,
        fontSize: 13,
        lineHeight: 17,
      }
    : {
        ...noWrapStyle,
        fontSize: 11,
        lineHeight: '15px',
        minHeight: 15,
      },
})

export default Row
