import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import {AllowedColors} from '../../../../common-adapters/text'
import * as Styles from '../../../../styles'
import {SimpleTopLine} from './top-line'
import {BottomLine} from './bottom-line'
import {Avatars, TeamAvatar} from '../../../avatars'
import * as RowSizes from '../sizes'
import * as ChatTypes from '../../../../constants/types/chat2'
import SwipeConvActions from './swipe-conv-actions'

export type Props = {
  backgroundColor?: string
  channelname?: string
  draft?: string
  hasBadge: boolean
  hasBottomLine: boolean
  hasResetUsers: boolean
  hasUnread: boolean
  iconHoverColor: string
  isDecryptingSnippet: boolean
  isFinalized: boolean
  isMuted: boolean
  isSelected: boolean
  isTypingSnippet: boolean
  onHideConversation: () => void
  onMuteConversation: () => void
  onSelectConversation: () => void
  participantNeedToRekey: boolean
  participants: Array<string>
  showBold: boolean
  snippet: string
  snippetDecoration: string
  subColor: AllowedColors
  teamname: string
  conversationIDKey: ChatTypes.ConversationIDKey
  timestamp: string
  usernameColor: string
  youAreReset: boolean
  youNeedToRekey: boolean
  isInWidget?: boolean
}

type State = {
  isHovered: boolean
  showMenu: boolean
}

const SmallTeamBox = Styles.isMobile
  ? Kb.ClickableBox
  : Styles.styled(Kb.Box)({
      '& .conversation-gear': {display: 'none'},
      ':hover .conversation-gear': {display: 'unset'},
      ':hover .conversation-timestamp': {display: 'none'},
    })

class SmallTeam extends React.PureComponent<Props, State> {
  state = {
    isHovered: false,
    showMenu: false,
  }

  _onMouseLeave = () => this.setState({isHovered: false})
  _onMouseOver = () => this.setState({isHovered: true})
  _onForceShowMenu = () => this.setState({showMenu: true})
  _onForceHideMenu = () => this.setState({showMenu: false})

  _backgroundColor = () =>
    // props.backgroundColor should always override hover styles, otherwise, there's a
    // moment when the conversation is loading that the selected inbox row is styled
    // with hover styles instead of props.backgroundColor.
    this.props.isSelected
      ? this.props.backgroundColor
      : this.state.isHovered
      ? Styles.globalColors.blueGreyDark
      : this.props.backgroundColor

  render() {
    const props = this.props
    const clickProps = {
      onClick: props.onSelectConversation,
      ...(Styles.isMobile ? {onLongPress: this._onForceShowMenu} : {}),
      onMouseLeave: this._onMouseLeave,
      onMouseOver: this._onMouseOver,
    }
    return (
      <SwipeConvActions
        isMuted={this.props.isMuted}
        onHideConversation={this.props.onHideConversation}
        onMuteConversation={this.props.onMuteConversation}
      >
        <SmallTeamBox
          {...clickProps}
          style={Styles.collapseStyles([{backgroundColor: this._backgroundColor()}, styles.container])}
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
                  {justifyContent: props.hasBottomLine ? 'flex-end' : 'center'},
                ])}
              >
                <SimpleTopLine
                  backgroundColor={props.backgroundColor}
                  hasUnread={props.hasUnread}
                  hasBadge={props.hasBadge}
                  iconHoverColor={props.iconHoverColor}
                  isSelected={props.isSelected}
                  participants={props.teamname ? [props.teamname] : props.participants}
                  showBold={props.showBold}
                  showGear={!props.isInWidget}
                  forceShowMenu={this.state.showMenu}
                  onForceHideMenu={this._onForceHideMenu}
                  subColor={props.subColor}
                  timestamp={props.timestamp}
                  usernameColor={props.usernameColor}
                  teamname={props.teamname}
                  conversationIDKey={props.conversationIDKey}
                  {...(props.channelname ? {channelname: props.channelname} : {})}
                />
              </Kb.Box>
              {props.hasBottomLine && (
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
                    draft={props.draft}
                  />
                </Kb.Box>
              )}
            </Kb.Box>
          </Kb.Box>
        </SmallTeamBox>
      </SwipeConvActions>
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
