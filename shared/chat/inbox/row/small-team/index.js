// @flow
import * as React from 'react'
import {Box, ClickableBox} from '../../../../common-adapters'
import {globalStyles, globalColors, isMobile} from '../../../../styles'
import {SimpleTopLine} from './top-line'
import {BottomLine} from './bottom-line'
import {Avatars, TeamAvatar} from '../avatars'

type Props = {
  backgroundColor: string,
  hasBadge: boolean,
  hasResetUsers: boolean,
  hasUnread: boolean,
  isMuted: boolean,
  isSelected: boolean,
  onSelectConversation: () => void,
  participantNeedToRekey: boolean,
  participants: Array<string>,
  showBold: boolean,
  snippet: string,
  subColor: string,
  teamname: ?string,
  timestamp: string,
  usernameColor: string,
  youAreReset: boolean,
  youNeedToRekey: boolean,
}

class SmallTeam extends React.PureComponent<Props> {
  render() {
    const props = this.props
    return (
      <ClickableBox onClick={props.onSelectConversation} style={{backgroundColor: props.backgroundColor}}>
        <Box style={props.isSelected ? rowContainerStyleSelected : rowContainerStyle}>
          {props.teamname ? (
            <TeamAvatar
              teamname={props.teamname}
              isMuted={props.isMuted}
              isSelected={this.props.isSelected}
            />
          ) : (
            <Avatars
              backgroundColor={props.backgroundColor}
              isMuted={props.isMuted}
              isSelected={props.isSelected}
              participantNeedToRekey={props.participantNeedToRekey}
              participants={props.participants}
              youNeedToRekey={props.youNeedToRekey}
            />
          )}
          <Box style={props.isSelected ? conversationRowStyleSelected : conversationRowStyle}>
            <SimpleTopLine
              hasUnread={props.hasUnread}
              hasBadge={props.hasBadge}
              participants={props.teamname ? [props.teamname] : props.participants}
              showBold={props.showBold}
              subColor={props.subColor}
              timestamp={props.timestamp}
              usernameColor={props.usernameColor}
            />
            <BottomLine
              backgroundColor={props.backgroundColor}
              participantNeedToRekey={props.participantNeedToRekey}
              youAreReset={props.youAreReset}
              showBold={props.showBold}
              snippet={props.snippet}
              subColor={props.subColor}
              hasResetUsers={props.hasResetUsers}
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
  backgroundColor: isMobile ? globalColors.white : globalColors.blue5,
  flexGrow: 1,
  justifyContent: 'center',
  paddingLeft: 8,
  paddingRight: 8,
}

const conversationRowStyleSelected = {
  ...conversationRowStyle,
  backgroundColor: globalColors.blue,
}
const rowHeight = isMobile ? 64 : 56

const rowContainerStyle = {
  ...globalStyles.flexBoxRow,
  ...globalStyles.clickable,
  backgroundColor: isMobile ? globalColors.white : globalColors.blue5,
  flexShrink: 0,
  maxHeight: rowHeight,
  minHeight: rowHeight,
}

const rowContainerStyleSelected = {
  ...rowContainerStyle,
  backgroundColor: globalColors.blue,
}

export {SmallTeam}
