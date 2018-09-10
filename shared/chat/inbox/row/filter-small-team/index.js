// @flow
import React, {PureComponent} from 'react'
import {Box, ClickableBox} from '../../../../common-adapters'
import {FilteredTopLine} from './top-line'
import {Avatars, TeamAvatar} from '../avatars'
import {
  globalStyles,
  desktopStyles,
  styleSheetCreate,
  platformStyles,
  collapseStyles,
} from '../../../../styles'
import * as RowSizes from '../sizes'

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
      <ClickableBox
        onClick={props.onSelectConversation}
        style={collapseStyles([styles.container, {backgroundColor: props.backgroundColor}])}
      >
        <Box style={collapseStyles([styles.rowContainer, {backgroundColor: props.backgroundColor}])}>
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
          <Box style={collapseStyles([styles.conversationRow, {backgroundColor: props.backgroundColor}])}>
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

const styles = styleSheetCreate({
  container: {
    flexShrink: 0,
    height: RowSizes.smallRowHeight,
  },
  conversationRow: {
    ...globalStyles.flexBoxColumn,
    flexGrow: 1,
    height: '100%',
    justifyContent: 'center',
    paddingLeft: 0,
    paddingRight: 8,
  },
  rowContainer: platformStyles({
    common: {
      alignItems: 'center',
      ...globalStyles.flexBoxRow,
      height: '100%',
    },
    isElectron: desktopStyles.clickable,
  }),
})

export {FilterSmallTeam}
