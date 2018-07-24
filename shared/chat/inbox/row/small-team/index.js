// @flow
import * as React from 'react'
import {Box, ClickableBox} from '../../../../common-adapters'
import {
  glamorous,
  globalStyles,
  globalColors,
  collapseStyles,
  isMobile,
  desktopStyles,
  styleSheetCreate,
  platformStyles,
} from '../../../../styles'
import {SimpleTopLine} from './top-line'
import {BottomLine} from './bottom-line'
import {Avatars, TeamAvatar} from '../avatars'
import * as RowSizes from '../sizes'

type Props = {
  backgroundColor: string,
  hasBadge: boolean,
  hasResetUsers: boolean,
  hasUnread: boolean,
  iconHoverColor: string,
  isFinalized: boolean,
  isMuted: boolean,
  isSelected: boolean,
  onSelectConversation: () => void,
  participantNeedToRekey: boolean,
  participants: Array<string>,
  showBold: boolean,
  snippet: string,
  snippetDecoration: string,
  subColor: string,
  teamname: string,
  timestamp: string,
  usernameColor: string,
  youAreReset: boolean,
  youNeedToRekey: boolean,
}

const SmallTeamBox = isMobile
  ? ClickableBox
  : glamorous(Box)({
      '& .small-team-gear': {display: 'none'},
      ':hover .small-team-gear': {display: 'unset'},
      ':hover .small-team-timestamp': {display: 'none'},
      ':not(.selected):hover': {backgroundColor: globalColors.red},
    })

class SmallTeam extends React.PureComponent<Props> {
  render() {
    const props = this.props
    return (
      <SmallTeamBox
        className={props.isSelected ? 'selected' : ''}
        onClick={props.onSelectConversation}
        style={collapseStyles([
          props.isSelected && {
            backgroundColor: props.backgroundColor,
          },
          styles.container,
        ])}
      >
        <Box style={collapseStyles([styles.rowContainer, styles.fastBlank])}>
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
              isLocked={props.youNeedToRekey || props.participantNeedToRekey || props.isFinalized}
              isSelected={props.isSelected}
              participants={props.participants}
            />
          )}
          <Box style={collapseStyles([styles.conversationRow, styles.fastBlank])}>
            <SimpleTopLine
              backgroundColor={props.backgroundColor}
              hasUnread={props.hasUnread}
              hasBadge={props.hasBadge}
              iconHoverColor={props.iconHoverColor}
              participants={props.teamname ? [props.teamname] : props.participants}
              showBold={props.showBold}
              showGear={!!props.teamname && !isMobile}
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
              snippetDecoration={props.snippetDecoration}
              subColor={props.subColor}
              hasResetUsers={props.hasResetUsers}
              youNeedToRekey={props.youNeedToRekey}
              isSelected={props.isSelected}
            />
          </Box>
        </Box>
      </SmallTeamBox>
    )
  }
}

const styles = styleSheetCreate({
  container: {flexShrink: 0, height: RowSizes.smallRowHeight},
  conversationRow: {
    ...globalStyles.flexBoxColumn,
    flexGrow: 1,
    height: '100%',
    justifyContent: 'center',
    paddingLeft: 8,
    paddingRight: 8,
  },
  fastBlank: platformStyles({
    isMobile: {
      backgroundColor: globalColors.fastBlank,
    },
  }),
  rowContainer: platformStyles({
    common: {
      ...globalStyles.flexBoxRow,
      height: '100%',
    },
    isElectron: desktopStyles.clickable,
  }),
  rowContainerSelected: platformStyles({
    common: {
      ...globalStyles.flexBoxRow,
      height: '100%',
    },
    isElectron: desktopStyles.clickable,
  }),
})

export {SmallTeam}
