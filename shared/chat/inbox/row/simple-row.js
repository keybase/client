// @flow
import React, {PureComponent} from 'react'
import {Box, ClickableBox} from '../../../common-adapters'
import {globalStyles} from '../../../styles'
import {List} from 'immutable'

import type {ConversationIDKey} from '../../../constants/chat'

import TopLine from './top-line'
import BottomLine from './bottom-line'
import {Avatars, TeamAvatar} from './avatars'

type Props = {
  backgroundColor: string,
  conversationIDKey: ConversationIDKey,
  filtered: boolean,
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
              filtered={props.filtered}
              hasUnread={props.hasUnread}
              participants={props.participants}
              showBold={props.showBold}
              subColor={props.subColor}
              teamname={props.teamname}
              timestamp={props.timestamp}
              usernameColor={props.usernameColor}
            />
            {props.filtered
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
