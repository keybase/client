// @flow
import React, {PureComponent} from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import {TeamAvatar} from '../avatars'
import * as RowSizes from '../sizes'

type Props = {
  isSelected: boolean,
  teamname: string,
  channelname: string,
  onSelectConversation: () => void,
}

type State = {
  isHovered: boolean,
}

class FilterBigTeamChannel extends PureComponent<Props, State> {
  state = {
    isHovered: false,
  }

  _onMouseLeave = () => this.setState({isHovered: false})
  _onMouseOver = () => this.setState({isHovered: true})

  render() {
    return (
      <Kb.ClickableBox onClick={this.props.onSelectConversation}>
        <Kb.Box
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
          <Kb.Text
            type="BodySemibold"
            style={Styles.collapseStyles([
              styles.teamname,
              {color: this.props.isSelected ? Styles.globalColors.white : Styles.globalColors.black_75},
            ])}
            title={this.props.teamname}
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
          >
            &nbsp;#
            {this.props.channelname}
          </Kb.Text>
        </Kb.Box>
      </Kb.ClickableBox>
    )
  }
}

const styles = Styles.styleSheetCreate({
  channelname: Styles.platformStyles({
    common: {flexBasis: '70%'},
    isElectron: {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
  }),
  filteredRow: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    flexShrink: 0,
    height: RowSizes.smallRowHeight,
    paddingRight: Styles.globalMargins.tiny,
    width: '100%',
  },
  teamname: Styles.platformStyles({
    common: {color: Styles.globalColors.black_75},
    isElectron: {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
  }),
})

export {FilterBigTeamChannel}
