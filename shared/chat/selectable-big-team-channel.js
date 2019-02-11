// @flow
import React, {PureComponent} from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import {TeamAvatar} from './avatars'
import {isMobile} from '../constants/platform'

type Props = {|
  isSelected: boolean,
  teamname: string,
  channelname: string,
  onSelectConversation: () => void,
|}

type State = {|
  isHovered: boolean,
|}

class SelectableBigTeamChannel extends PureComponent<Props, State> {
  state = {
    isHovered: false,
  }

  _onMouseLeave = () => this.setState({isHovered: false})
  _onMouseOver = () => this.setState({isHovered: true})

  render() {
    return (
      <Kb.ClickableBox onClick={this.props.onSelectConversation}>
        <Kb.Box2
          direction="horizontal"
          fullWidth={true}
          centerChildren={true}
          gap="tiny"
          className="hover_background_color_blueGrey2"
          style={Styles.collapseStyles([
            styles.filteredRow,
            this.props.isSelected && {backgroundColor: Styles.globalColors.blue},
          ])}
          onMouseLeave={this._onMouseLeave}
          onMouseOver={this._onMouseOver}
        >
          <TeamAvatar
            teamname={this.props.teamname}
            isMuted={false}
            isSelected={false}
            isHovered={this.state.isHovered}
          />
          <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.textContainer}>
            <Kb.Text
              type="BodySemibold"
              style={Styles.collapseStyles([
                styles.teamname,
                {color: this.props.isSelected ? Styles.globalColors.white : Styles.globalColors.black_75},
              ])}
              title={this.props.teamname}
              lineClamp={isMobile ? 1 : undefined}
              ellipsizeMode="tail"
            >
              {this.props.teamname}
            </Kb.Text>
            <Kb.Text
              type="Body"
              style={Styles.collapseStyles([
                styles.channelname,
                {color: this.props.isSelected ? Styles.globalColors.white : Styles.globalColors.black_75},
              ])}
              title={`#${this.props.channelname}`}
              lineClamp={isMobile ? 1 : undefined}
              ellipsizeMode="tail"
            >
              &nbsp;#
              {this.props.channelname}
            </Kb.Text>
          </Kb.Box2>
        </Kb.Box2>
      </Kb.ClickableBox>
    )
  }
}

export const rowHeight = isMobile ? 64 : 56

const styles = Styles.styleSheetCreate({
  channelname: Styles.platformStyles({
    common: {
      flexShrink: 0,
      maxWidth: '70%',
    },
    isElectron: {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
  }),
  filteredRow: {
    height: rowHeight,
  },
  teamname: Styles.platformStyles({
    common: {
      color: Styles.globalColors.black_75,
      flexShrink: 1,
    },
    isElectron: {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
  }),
  textContainer: {
    flexShrink: 1,
    overflow: 'hidden',
    paddingRight: Styles.globalMargins.tiny,
  },
})

export default SelectableBigTeamChannel
