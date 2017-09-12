// @flow
import React, {PureComponent} from 'react'
import {Box, ClickableBox} from '../../../common-adapters'
import {globalStyles} from '../../../styles'
import {List} from 'immutable'

import {SimpleTopLine, FilteredTopLine} from './top-line'
import BottomLine from './bottom-line'
import {Avatars, TeamAvatar} from './avatars'
import {isMobile} from '../../../constants/platform'

type SimpleProps = {
  backgroundColor: string,
  hasUnread: boolean,
  isMuted: boolean,
  isSelected: boolean,
  onSelectConversation: () => void,
  participantNeedToRekey: boolean,
  participants: List<string>,
  showBold: boolean,
  snippet: string,
  subColor: string,
  teamname: ?string,
  timestamp: string,
  usernameColor: string,
  youNeedToRekey: boolean,
  hasBadge: boolean,
}

class SmallTeamRow extends PureComponent<SimpleProps> {
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
            <SimpleTopLine
              hasUnread={props.hasUnread}
              hasBadge={props.hasBadge}
              participants={props.teamname ? List.of(props.teamname) : props.participants}
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

type FilteredProps = {
  backgroundColor: string,
  isMuted: boolean,
  isSelected: boolean,
  onSelectConversation: () => void,
  participantNeedToRekey: boolean,
  participants: List<string>,
  showBold: boolean,
  teamname: ?string,
  usernameColor: string,
  youNeedToRekey: boolean,
}

class SmallTeamFilteredRow extends PureComponent<FilteredProps> {
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
              paddingLeft: 0,
              backgroundColor: props.backgroundColor,
            }}
          >
            <FilteredTopLine
              participants={props.teamname ? List.of(props.teamname) : props.participants}
              showBold={props.showBold}
              usernameColor={props.usernameColor}
            />
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

const rowHeight = isMobile ? 64 : 56

const rowContainerStyle = {
  ...globalStyles.flexBoxRow,
  ...globalStyles.clickable,
  flexShrink: 0,
  maxHeight: rowHeight,
  minHeight: rowHeight,
}

export {SmallTeamRow, SmallTeamFilteredRow}
