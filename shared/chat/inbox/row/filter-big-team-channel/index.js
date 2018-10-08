// @flow
import React, {PureComponent} from 'react'
import {Box, Text, ClickableBox} from '../../../../common-adapters'
import {globalStyles, globalMargins, platformStyles, styleSheetCreate} from '../../../../styles'
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
      <ClickableBox onClick={this.props.onSelectConversation}>
        <Box
          className={this.props.isSelected ? 'background_color_blue' : 'hover_background_color_blueGrey2'}
          style={styles.filteredRow}
          onMouseLeave={this._onMouseLeave}
          onMouseOver={this._onMouseOver}
        >
          <TeamAvatar
            teamname={this.props.teamname}
            isMuted={false}
            isSelected={false}
            isHovered={this.state.isHovered}
          />
          <Text
            className={this.props.isSelected ? 'color_white' : 'color_black_75'}
            type="BodySemibold"
            style={styles.teamname}
            title={this.props.teamname}
          >
            {this.props.teamname}
          </Text>
          <Text
            className={this.props.isSelected ? 'color_white' : 'color_black_75'}
            type="Body"
            style={styles.channelname}
            title={`#${this.props.channelname}`}
          >
            &nbsp;#
            {this.props.channelname}
          </Text>
        </Box>
      </ClickableBox>
    )
  }
}

const styles = styleSheetCreate({
  channelname: platformStyles({
    common: {flexBasis: '70%'},
    isElectron: {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
  }),
  filteredRow: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center',
    flexShrink: 0,
    height: RowSizes.smallRowHeight,
    paddingRight: globalMargins.tiny,
    width: '100%',
  },
  teamname: platformStyles({
    isElectron: {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
  }),
})

export {FilterBigTeamChannel}
