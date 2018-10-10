// @flow
import React, {PureComponent} from 'react'
import {Box, ClickableBox} from '../../../../common-adapters'
import {FilteredTopLine} from './top-line'
import {Avatars, TeamAvatar} from '../avatars'
import {desktopStyles, globalStyles, platformStyles, styleSheetCreate} from '../../../../styles'
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
      <ClickableBox onClick={props.onSelectConversation} style={styles.container}>
        <Box
          className={`channel_name ${
            this.props.isSelected
              ? 'active background_color_blue'
              : 'inactive hover_background_color_blueGrey2'
          }`}
          style={styles.rowContainer}
        >
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
          <Box style={styles.conversationRow}>
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
