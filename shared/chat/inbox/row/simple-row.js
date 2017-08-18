// @flow
import React, {PureComponent} from 'react'
import {Avatar, MultiAvatar, Icon, Box, ClickableBox} from '../../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../../styles'
import {isMobile} from '../../../constants/platform'
import memoize from 'lodash/memoize'
import {List} from 'immutable'

import type {ConversationIDKey} from '../../../constants/chat'

import TopLine from './top-line'
import BottomLine from './bottom-line'

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
            multiSize={32}
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

class TeamAvatar extends PureComponent<void, {teamname: string}, void> {
  render() {
    return (
      <Box style={_avatarBoxStyle}>
        <Avatar teamname={this.props.teamname} size={40} />
      </Box>
    )
  }
}

type Props = {
  backgroundColor: string,
  conversationIDKey: ConversationIDKey,
  filter: string,
  hasUnread: boolean,
  isMuted: boolean,
  isSelected: boolean,
  onSelectConversation: () => void,
  participantNeedToRekey: boolean,
  participants: List<string>,
  rekeyInfo: any,
  showBold: boolean,
  snippet: string,
  subColor: string,
  teamname: ?string,
  timestamp: string,
  unreadCount: number,
  usernameColor: string,
  youNeedToRekey: boolean,
}

class Row extends PureComponent<void, Props, void> {
  render() {
    const props = this.props
    return (
      <ClickableBox onClick={props.onSelectConversation} style={{backgroundColor: props.backgroundColor}}>
        <Box style={{...rowContainerStyle, backgroundColor: props.backgroundColor}}>
          {props.teamname
            ? <TeamAvatar teamname={props.teamname} />
            : <Avatars
                backgroundColor={props.backgroundColor}
                isMuted={props.isMuted}
                isSelected={props.isSelected}
                participantNeedToRekey={props.participantNeedToRekey}
                participants={props.participants}
                youNeedToRekey={props.youNeedToRekey}
              />}
          <Box
            style={{
              ...conversationRowStyle,
              backgroundColor: props.backgroundColor,
            }}
          >
            <TopLine
              filter={props.filter}
              hasUnread={props.hasUnread}
              participants={props.participants}
              showBold={props.showBold}
              subColor={props.subColor}
              teamname={props.teamname}
              timestamp={props.timestamp}
              usernameColor={props.usernameColor}
            />
            {props.filter
              ? null
              : <BottomLine
                  backgroundColor={props.backgroundColor}
                  participantNeedToRekey={props.participantNeedToRekey}
                  showBold={props.showBold}
                  snippet={props.snippet}
                  subColor={props.subColor}
                  youNeedToRekey={props.youNeedToRekey}
                />}
          </Box>
        </Box>
      </ClickableBox>
    )
  }
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

const rowContainerStyle = {
  ...globalStyles.flexBoxRow,
  ...globalStyles.clickable,
  flexShrink: 0,
  maxHeight: 56,
  minHeight: 56,
}

export default Row
