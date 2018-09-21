// @flow
import React, {PureComponent} from 'react'
import {Box, ClickableBox} from '../../../../common-adapters'
import {FilteredTopLine} from './top-line'
import {Avatars, TeamAvatar} from '../avatars'
import {
  collapseStyles,
  desktopStyles,
  glamorous,
  globalStyles,
  globalColors,
  isMobile,
  platformStyles,
  styleSheetCreate,
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

type State = {
  isHovered: boolean,
}

const HoverBox = isMobile
  ? Box
  : glamorous(Box)({
      ':hover': {backgroundColor: globalColors.blueGrey2},
    })

class FilterSmallTeam extends PureComponent<Props, State> {
  state = {
    isHovered: false,
  }

  _onMouseLeave = () => this.setState({isHovered: false})
  _onMouseOver = () => this.setState({isHovered: true})

  render() {
    const props = this.props
    return (
      <ClickableBox
        onClick={props.onSelectConversation}
        style={collapseStyles([styles.container, {backgroundColor: props.backgroundColor}])}
      >
        <HoverBox
          style={collapseStyles([styles.rowContainer, {backgroundColor: props.backgroundColor}])}
          onMouseLeave={this._onMouseLeave}
          onMouseOver={this._onMouseOver}
        >
          {props.teamname ? (
            <TeamAvatar
              teamname={props.teamname}
              isHovered={this.state.isHovered}
              isMuted={this.props.isMuted}
              isSelected={this.props.isSelected}
            />
          ) : (
            <Avatars
              backgroundColor={props.backgroundColor}
              isHovered={this.state.isHovered}
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
        </HoverBox>
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
