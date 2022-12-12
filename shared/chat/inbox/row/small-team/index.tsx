import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import type {AllowedColors} from '../../../../common-adapters/text'
import * as Styles from '../../../../styles'
import {SimpleTopLine} from './top-line'
import {BottomLine} from './bottom-line'
import {Avatars, TeamAvatar} from '../../../avatars'
import * as RowSizes from '../sizes'
import type * as ChatTypes from '../../../../constants/types/chat2'
import SwipeConvActions from './swipe-conv-actions'
import type * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import './small-team.css'

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
  layoutSnippet?: string
  layoutSnippetDecoration: RPCChatTypes.SnippetDecoration
  onHideConversation: () => void
  onMuteConversation: (muted: boolean) => void
  onSelectConversation?: () => void
  participantNeedToRekey: boolean
  participants: Array<string>
  showBold: boolean
  snippet: string
  snippetDecoration: RPCChatTypes.SnippetDecoration
  subColor: AllowedColors
  teamname: string
  conversationIDKey: ChatTypes.ConversationIDKey
  timestamp: string
  usernameColor: AllowedColors
  youAreReset: boolean
  youNeedToRekey: boolean
  isInWidget?: boolean
}

type State = {
  showMenu: boolean
}

class SmallTeam extends React.PureComponent<Props, State> {
  state = {
    showMenu: false,
  }

  _onForceShowMenu = () => this.setState({showMenu: true})
  _onForceHideMenu = () => this.setState({showMenu: false})

  private onMuteConversation = () => {
    this.props.onMuteConversation(!this.props.isMuted)
  }

  render() {
    const props = this.props
    const clickProps = {
      onClick: props.onSelectConversation,
      // its invalid to use onLongPress with no onClick
      ...(Styles.isMobile ? {onLongPress: props.onSelectConversation && this._onForceShowMenu} : {}),
    }
    return (
      <SwipeConvActions
        isMuted={this.props.isMuted}
        onHideConversation={this.props.onHideConversation}
        onMuteConversation={this.onMuteConversation}
      >
        <Kb.ClickableBox
          className={Styles.classNames('small-row', {selected: props.isSelected})}
          {...clickProps}
          style={styles.container}
        >
          <Kb.Box style={Styles.collapseStyles([styles.rowContainer, styles.fastBlank] as const)}>
            {props.teamname ? (
              <TeamAvatar
                teamname={props.teamname}
                isMuted={props.isMuted}
                isSelected={this.props.isSelected}
                isHovered={false}
              />
            ) : (
              <Avatars
                backgroundColor={props.backgroundColor}
                isHovered={false}
                isMuted={props.isMuted}
                isLocked={props.youNeedToRekey || props.participantNeedToRekey || props.isFinalized}
                isSelected={props.isSelected}
                participantOne={props.participants[0]}
                participantTwo={props.participants[1]}
              />
            )}
            <Kb.Box style={Styles.collapseStyles([styles.conversationRow, styles.fastBlank])}>
              <Kb.Box
                style={Styles.collapseStyles([
                  Styles.globalStyles.flexBoxColumn,
                  styles.flexOne,
                  props.hasBottomLine ? styles.withBottomLine : styles.withoutBottomLine,
                ])}
              >
                <SimpleTopLine
                  backgroundColor={props.backgroundColor}
                  hasUnread={props.hasUnread}
                  hasBadge={props.hasBadge}
                  iconHoverColor={props.iconHoverColor}
                  isSelected={props.isSelected}
                  participants={props.teamname ? props.teamname : props.participants}
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
                    snippet={props.snippet || props.layoutSnippet || ''}
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
        </Kb.ClickableBox>
      </SwipeConvActions>
    )
  }
}

const styles = Styles.styleSheetCreate(() => ({
  container: Styles.platformStyles({
    common: {
      flexShrink: 0,
      height: RowSizes.smallRowHeight,
    },
    isMobile: {
      marginLeft: Styles.globalMargins.xtiny,
      marginRight: Styles.globalMargins.xtiny,
    },
  }),
  conversationRow: {
    ...Styles.globalStyles.flexBoxColumn,
    flexGrow: 1,
    height: '100%',
    justifyContent: 'center',
    paddingLeft: Styles.globalMargins.tiny,
  },
  fastBlank: Styles.platformStyles({
    isPhone: {
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
      paddingLeft: Styles.globalMargins.xsmall,
      paddingRight: Styles.globalMargins.xsmall,
    },
    isElectron: Styles.desktopStyles.clickable,
  }),
  withBottomLine: {
    justifyContent: 'flex-end',
    paddingBottom: Styles.globalMargins.xxtiny,
  },
  withoutBottomLine: {justifyContent: 'center'},
}))

export {SmallTeam}
