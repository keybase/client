// @flow
import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import {SimpleTopLine} from './top-line'
import {BottomLine} from './bottom-line'
import {Avatars, TeamAvatar} from '../../../avatars'
import * as RowSizes from '../sizes'

export type Props = {
  backgroundColor: ?string,
  channelname?: string,
  hasBadge: boolean,
  hasResetUsers: boolean,
  hasUnread: boolean,
  iconHoverColor: string,
  isDecryptingSnippet: boolean,
  isFinalized: boolean,
  isMuted: boolean,
  isSelected: boolean,
  isTypingSnippet: boolean,
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
  isInWidget?: boolean,
}

type State = {
  isHovered: boolean,
}

const SmallTeamBox = Styles.isMobile
  ? Kb.ClickableBox
  : Styles.styled(Kb.Box)({
      '& .small-team-gear': {display: 'none'},
      ':hover .small-team-gear': {display: 'unset'},
      ':hover .small-team-timestamp': {display: 'none'},
    })

class SmallTeam extends React.PureComponent<Props, State> {
  state = {
    isHovered: false,
  }

  _onMouseLeave = () => this.setState({isHovered: false})
  _onMouseOver = () => this.setState({isHovered: true})

  _backgroundColor = () =>
    // props.backgroundColor should always override hover styles, otherwise, there's a
    // moment when the conversation is loading that the selected inbox row is styled
    // with hover styles instead of props.backgroundColor.
    this.props.isSelected
      ? this.props.backgroundColor
      : this.state.isHovered
      ? Styles.globalColors.blueGrey2
      : this.props.backgroundColor

  render() {
    const props = this.props
    return (
      <SmallTeamBox
        onClick={props.onSelectConversation}
        onMouseLeave={this._onMouseLeave}
        onMouseOver={this._onMouseOver}
        style={Styles.collapseStyles([
          {
            backgroundColor: this._backgroundColor(),
          },
          styles.container,
        ])}
      >
        <Kb.Box style={Styles.collapseStyles([styles.rowContainer, styles.fastBlank])}>
          {props.teamname ? (
            <TeamAvatar
              teamname={props.teamname}
              isMuted={props.isMuted}
              isSelected={this.props.isSelected}
              isHovered={this.state.isHovered}
            />
          ) : (
            <Avatars
              backgroundColor={this._backgroundColor()}
              isHovered={this.state.isHovered}
              isMuted={props.isMuted}
              isLocked={props.youNeedToRekey || props.participantNeedToRekey || props.isFinalized}
              isSelected={props.isSelected}
              participants={props.participants}
            />
          )}
          <Kb.Box style={Styles.collapseStyles([styles.conversationRow, styles.fastBlank])}>
            <Kb.Box
              style={Styles.collapseStyles([
                Styles.globalStyles.flexBoxColumn,
                styles.flexOne,
                {justifyContent: 'flex-end'},
              ])}
            >
              <SimpleTopLine
                backgroundColor={props.backgroundColor}
                hasUnread={props.hasUnread}
                hasBadge={props.hasBadge}
                iconHoverColor={props.iconHoverColor}
                participants={props.teamname ? [props.teamname] : props.participants}
                showBold={props.showBold}
                showGear={!!props.teamname && !Styles.isMobile && !props.isInWidget}
                subColor={props.subColor}
                timestamp={props.timestamp}
                usernameColor={props.usernameColor}
                teamname={props.teamname}
                {...(props.channelname ? {channelname: props.channelname} : {})}
              />
            </Kb.Box>
            <Kb.Box
              style={Styles.collapseStyles([
                Styles.globalStyles.flexBoxColumn,
                styles.flexOne,
                {justifyContent: 'flex-start'},
              ])}
            >
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
                isDecryptingSnippet={props.isDecryptingSnippet}
                isTypingSnippet={props.isTypingSnippet}
              />
            </Kb.Box>
          </Kb.Box>
        </Kb.Box>
      </SmallTeamBox>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: {flexShrink: 0, height: RowSizes.smallRowHeight},
  conversationRow: {
    ...Styles.globalStyles.flexBoxColumn,
    flexGrow: 1,
    height: '100%',
    justifyContent: 'center',
    paddingLeft: 8,
    paddingRight: 8,
  },
  fastBlank: Styles.platformStyles({
    isMobile: {
      backgroundColor: Styles.globalColors.fastBlank,
    },
  }),
  flexOne: {
    flex: 1,
  },
  rowContainer: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxRow,
      alignItems: 'center',
      height: '100%',
    },
    isElectron: Styles.desktopStyles.clickable,
  }),
})

export {SmallTeam}
