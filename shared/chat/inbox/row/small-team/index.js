// @flow
import React, {PureComponent} from 'react'
import {Box, ClickableBox} from '../../../../common-adapters'
import {globalStyles} from '../../../../styles'
import {List} from 'immutable'

import {SimpleTopLine} from './top-line'
import {BottomLine} from './bottom-line'
import {Avatars, TeamAvatar} from '.././avatars'
import {isMobile} from '../../../../constants/platform'

type Props = {
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

class SmallTeam extends PureComponent<Props> {
  render() {
    const props = this.props
    return (
      <ClickableBox onClick={props.onSelectConversation} style={{backgroundColor: props.backgroundColor}}>
        <Box style={{...rowContainerStyle, backgroundColor: props.backgroundColor}}>
          {props.teamname
            ? <TeamAvatar
                teamname={props.teamname}
                isMuted={props.isMuted}
                isSelected={this.props.isSelected}
              />
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

export {SmallTeam}
