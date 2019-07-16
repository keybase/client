import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import {FilteredTopLine} from './top-line'
import {Avatars, TeamAvatar} from './avatars'

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
            this.props.isSelected && {backgroundColor: Styles.globalColors.blue},
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
              participants={props.participants}
            />
          )}
          <Kb.Box style={styles.conversationRow}>
            <FilteredTopLine
              isSelected={props.isSelected}
              numSearchHits={props.numSearchHits}
              maxSearchHits={props.maxSearchHits}
              participants={props.teamname ? [props.teamname] : props.participants}
              showBold={props.showBold}
              usernameColor={props.usernameColor}
            />
          </Kb.Box>
          {this.props.showBadge && <Kb.Box2 direction="horizontal" style={styles.badge} />}
        </Kb.Box2>
      </Kb.ClickableBox>
    )
  }
}

export const rowHeight = Styles.isMobile ? 64 : 56

const styles = Styles.styleSheetCreate({
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
  conversationRow: {
    ...Styles.globalStyles.flexBoxColumn,
    flexGrow: 1,
    height: '100%',
    justifyContent: 'center',
  },
  rowContainer: Styles.platformStyles({
    common: {
      paddingLeft: Styles.globalMargins.xtiny,
      paddingRight: Styles.globalMargins.xtiny,
    },
    isElectron: Styles.desktopStyles.clickable,
  }),
})

export default SelectableSmallTeam
