// @flow
import React, {PureComponent} from 'react'
import {Text, MultiAvatar, Icon, Usernames, Markdown, Box, ClickableBox} from '../../../common-adapters'
import {
  globalStyles,
  globalColors,
  globalMargins,
  styleSheetCreate,
  collapseStyles,
  lineHeight,
} from '../../../styles'
import {isMobile} from '../../../constants/platform'
import memoize from 'lodash/memoize'
import {List} from 'immutable'

import type {ConversationIDKey} from '../../../constants/chat'

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

type TopLineProps = {
  hasUnread: boolean,
  participants: List<string>,
  showBold: boolean,
  subColor: ?string,
  timestamp: ?string,
  usernameColor: ?string,
}

class TopLine extends PureComponent<void, TopLineProps, void> {
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
        <Text type="BodySmall" style={{...boldOverride, color: subColor, lineHeight: lineHeight(height)}}>
          {timestamp}
        </Text>
        {hasUnread && <Box style={unreadDotStyle} />}
      </Box>
    )
  }
}

type BottomLineProps = {
  backgroundColor: ?string,
  participantNeedToRekey: boolean,
  showBold: boolean,
  snippet: ?string,
  subColor: ?string,
  youNeedToRekey: boolean,
}

class BottomLine extends PureComponent<void, BottomLineProps, void> {
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
          baseStyle,
          {
            color: subColor,
            ...(showBold ? globalStyles.fontBold : {}),
          },
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
          backgroundColor: isMobile ? backgroundColor : undefined,
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

type AvatarProps = {
  participants: List<string>,
  youNeedToRekey: boolean,
  participantNeedToRekey: boolean,
  isMuted: boolean,
  isSelected: boolean,
  backgroundColor: string,
}

class Avatars extends PureComponent<void, AvatarProps, void> {
  render() {
    const {
      participants,
      youNeedToRekey,
      participantNeedToRekey,
      isMuted,
      isSelected,
      backgroundColor,
    } = this.props

    const avatarCount = Math.min(2, participants.count())

    let icon
    if (isMuted) {
      const type = isSelected
        ? isMobile ? 'icon-shh-active-24' : 'icon-shh-active-16'
        : isMobile ? 'icon-shh-24' : 'icon-shh-16'
      icon = <Icon type={type} style={avatarMutedIconStyle} />
    } else if (participantNeedToRekey || youNeedToRekey) {
      const type = isSelected
        ? isMobile ? 'icon-addon-lock-active-12' : 'icon-addon-lock-active-8'
        : isMobile ? 'icon-addon-lock-12' : 'icon-addon-lock-8'
      icon = <Icon type={type} style={avatarLockIconStyle} />
    }

    const opacity = youNeedToRekey || participantNeedToRekey ? 0.4 : 1
    const avatarProps = participants
      .slice(0, 2)
      .map((username, idx) => ({
        borderColor: rowBorderColor(idx, idx === avatarCount - 1, backgroundColor),
        loadingColor: globalColors.lightGrey,
        size: isMobile ? 24 : 32,
        skipBackground: isMobile,
        username,
      }))
      .toArray()

    return (
      <Box style={avatarBoxStyle(backgroundColor)}>
        <Box style={avatarInnerBoxStyle}>
          <MultiAvatar
            singleSize={isMobile ? 48 : 40}
            multiSize={isMobile ? 24 : 32}
            avatarProps={avatarProps}
            multiPadding={isMobile ? 2 : 0}
            style={{...multiStyle(backgroundColor), opacity}}
          />
          {icon}
        </Box>
      </Box>
    )
  }
}

const multiStyle = memoize(backgroundColor => {
  return {
    ...(isMobile ? {paddingBottom: 10, paddingTop: 10} : {}),
    backgroundColor,
    height: '100%',
    width: '100%',
  }
})

const avatarBoxStyle = memoize(backgroundColor => {
  return {
    ..._avatarBoxStyle,
    backgroundColor,
  }
})

const _avatarBoxStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  flexShrink: 0,
  justifyContent: 'flex-start',
  marginLeft: globalMargins.tiny,
  marginRight: globalMargins.tiny,
  maxWidth: isMobile ? 48 : 40,
  minWidth: isMobile ? 48 : 40,
}

const avatarInnerBoxStyle = {
  height: '100%',
  maxWidth: isMobile ? 48 : 40,
  minWidth: isMobile ? 48 : 40,
  paddingBottom: 4,
  paddingTop: 4,
  position: 'relative',
}

type Props = {
  backgroundColor: string,
  conversationIDKey: ConversationIDKey,
  hasUnread: boolean,
  isMuted: boolean,
  isSelected: boolean,
  onSelectConversation: (key: ConversationIDKey) => void,
  participantNeedToRekey: boolean,
  participants: List<string>,
  rekeyInfo: any,
  showBold: boolean,
  snippet: string,
  subColor: string,
  timestamp: string,
  unreadCount: number,
  usernameColor: string,
  youNeedToRekey: boolean,
}

class Row extends PureComponent<void, Props, void> {
  render() {
    const props = this.props
    return (
      <ClickableBox
        onClick={() => props.onSelectConversation(props.conversationIDKey)}
        style={{backgroundColor: props.backgroundColor}}
      >
        <Box style={{...rowContainerStyle, backgroundColor: props.backgroundColor}}>
          <Avatars
            backgroundColor={props.backgroundColor}
            isMuted={props.isMuted}
            isSelected={props.isSelected}
            participantNeedToRekey={props.participantNeedToRekey}
            participants={props.participants}
            youNeedToRekey={props.youNeedToRekey}
          />
          <Box
            style={{
              ...conversationRowStyle,
              backgroundColor: props.backgroundColor,
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
          </Box>
        </Box>
      </ClickableBox>
    )
  }
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
  ...globalStyles.flexBoxColumn,
  flexGrow: 1,
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
        lineHeight: lineHeight(17),
        marginTop: 2,
        paddingRight: 30,
      }
    : {
        ...noWrapStyle,
        color: globalColors.black_40,
        fontSize: 11,
        lineHeight: lineHeight(15),
        minHeight: 15,
        paddingRight: 30,
      },
})

export default Row
