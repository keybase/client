import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import {FilteredTopLine} from './top-line'
import {BottomLine} from './inbox/row/small-team/bottom-line'
import {Avatars, TeamAvatar} from './avatars'
import type * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import {SnippetContext} from './inbox/row/small-team/contexts'

type Props = {
  backgroundColor?: string
  isMuted: boolean
  isSelected: boolean
  onSelectConversation: () => void
  isLocked: boolean
  numSearchHits?: number
  maxSearchHits?: number
  participants: Array<string>
  showBadge: boolean
  showBold: boolean
  snippet?: string
  snippetDecoration: RPCChatTypes.SnippetDecoration
  teamname: string
  usernameColor: string
}

type State = {
  isHovered: boolean
}

class SelectableSmallTeam extends React.PureComponent<Props, State> {
  state = {
    isHovered: false,
  }

  _onMouseLeave = () => this.setState({isHovered: false})
  _onMouseOver = () => this.setState({isHovered: true})

  render() {
    const props = this.props
    if (!props.teamname && props.participants.length === 0) {
      return (
        <Kb.ClickableBox onClick={props.onSelectConversation}>
          <Kb.Box2 direction="vertical" style={styles.container} centerChildren={true}>
            <Kb.ProgressIndicator style={styles.spinner} type="Small" />
          </Kb.Box2>
        </Kb.ClickableBox>
      )
    }
    return (
      <Kb.ClickableBox onClick={props.onSelectConversation} style={styles.container}>
        <Kb.Box2
          alignItems="center"
          direction="horizontal"
          fullWidth={true}
          fullHeight={true}
          className={Styles.classNames('hover_background_color_blueGreyDark', {
            background_color_blue: props.isSelected,
          })}
          style={Styles.collapseStyles([
            styles.rowContainer,
            {backgroundColor: this.props.isSelected ? Styles.globalColors.blue : Styles.globalColors.white},
          ])}
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
              participantOne={props.participants[0]}
              participantTwo={props.participants[1]}
            />
          )}
          <Kb.Box2 direction="vertical" style={Styles.globalStyles.flexOne}>
            <FilteredTopLine
              isSelected={props.isSelected}
              numSearchHits={props.numSearchHits}
              maxSearchHits={props.maxSearchHits}
              participants={props.teamname ? [props.teamname] : props.participants}
              showBold={props.showBold}
              usernameColor={props.usernameColor}
            />
            {!props.numSearchHits && (
              <SnippetContext.Provider value={props.snippet ?? ''}>
                <BottomLine isDecryptingSnippet={false} isSelected={props.isSelected} />
              </SnippetContext.Provider>
            )}
          </Kb.Box2>
          {this.props.showBadge && <Kb.Box2 direction="horizontal" style={styles.badge} />}
        </Kb.Box2>
      </Kb.ClickableBox>
    )
  }
}

export const rowHeight = Styles.isMobile ? 64 : 56

const styles = Styles.styleSheetCreate(() => ({
  badge: {
    backgroundColor: Styles.globalColors.orange,
    borderRadius: 6,
    flexShrink: 0,
    height: Styles.globalMargins.tiny,
    width: Styles.globalMargins.tiny,
  },
  container: {
    flexShrink: 0,
    height: rowHeight,
  },
  rowContainer: Styles.platformStyles({
    isElectron: {
      ...Styles.desktopStyles.clickable,
      paddingLeft: Styles.globalMargins.xsmall,
      paddingRight: Styles.globalMargins.xsmall,
    },
    isMobile: {
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
    },
  }),
  spinner: {
    alignSelf: 'center',
  },
}))

export default SelectableSmallTeam
