// @flow
import React, {PureComponent} from 'react'
import {Box, ClickableBox} from '../../../../common-adapters'
import {FilteredTopLine} from './top-line'
import {Avatars, TeamAvatar} from '../avatars'
import {globalStyles, isMobile, desktopStyles} from '../../../../styles'

type Props = {
  backgroundColor: string,
  isMuted: boolean,
  isSelected: boolean,
  onSelectConversation: () => void,
  isLocked: boolean,
  participants: Array<string>,
  showBold: boolean,
  teamname: string,
  usernameColor: string,
}

class FilterSmallTeam extends PureComponent<Props> {
  render() {
    const props = this.props
    return (
      <ClickableBox onClick={props.onSelectConversation} style={{backgroundColor: props.backgroundColor}}>
        <Box style={{...rowContainerStyle, backgroundColor: props.backgroundColor}}>
          {props.teamname ? (
            <TeamAvatar
              teamname={props.teamname}
              isMuted={this.props.isMuted}
              isSelected={this.props.isSelected}
            />
          ) : (
            <Avatars
              backgroundColor={props.backgroundColor}
              isMuted={props.isMuted}
              isSelected={props.isSelected}
              isLocked={props.isLocked}
              participants={props.participants}
            />
          )}
          <Box
            style={{
              ...conversationRowStyle,
              backgroundColor: props.backgroundColor,
              paddingLeft: 0,
            }}
          >
            <FilteredTopLine
              participants={props.teamname ? [props.teamname] : props.participants}
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
  ...desktopStyles.clickable,
  flexShrink: 0,
  maxHeight: rowHeight,
  minHeight: rowHeight,
}

export {FilterSmallTeam}
