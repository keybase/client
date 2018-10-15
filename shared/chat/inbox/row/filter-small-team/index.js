// @flow
import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import {FilteredTopLine} from './top-line'
import {Avatars, TeamAvatar} from '../avatars'
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

class FilterSmallTeam extends React.PureComponent<Props, State> {
  state = {
    isHovered: false,
  }

  _onMouseLeave = () => this.setState({isHovered: false})
  _onMouseOver = () => this.setState({isHovered: true})

  render() {
    const props = this.props
    return (
      <Kb.ClickableBox onClick={props.onSelectConversation} style={styles.container}>
        <Kb.Box
          className={Styles.classNames('hover_background_color_blueGrey2', {
            background_color_blue: props.isSelected,
          })}
          style={styles.rowContainer}
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
              participants={props.teamname ? [props.teamname] : props.participants}
              showBold={props.showBold}
              usernameColor={props.usernameColor}
            />
          </Kb.Box>
        </Kb.Box>
      </Kb.ClickableBox>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: {
    flexShrink: 0,
    height: RowSizes.smallRowHeight,
  },
  conversationRow: {
    ...Styles.globalStyles.flexBoxColumn,
    flexGrow: 1,
    height: '100%',
    justifyContent: 'center',
    paddingLeft: 0,
    paddingRight: 8,
  },
  rowContainer: Styles.platformStyles({
    common: {
      alignItems: 'center',
      ...Styles.globalStyles.flexBoxRow,
      height: '100%',
    },
    isElectron: Styles.desktopStyles.clickable,
  }),
})

export {FilterSmallTeam}
