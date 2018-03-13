// @flow
import React, {PureComponent} from 'react'
import {Box, Text, ClickableBox} from '../../../../common-adapters'
import {globalStyles, globalColors, globalMargins, platformStyles} from '../../../../styles'
import {TeamAvatar} from '../avatars'

type Props = {
  teamname: string,
  channelname: string,
  onSelectConversation: () => void,
}

class FilterBigTeamChannel extends PureComponent<Props> {
  render() {
    return (
      <ClickableBox onClick={this.props.onSelectConversation}>
        <Box
          style={{
            ...filteredRowStyle,
            ...(this.props.isSelected ? {backgroundColor: globalColors.blue} : undefined),
          }}
        >
          <TeamAvatar teamname={this.props.teamname} isMuted={false} isSelected={false} />
          <Text
            type="BodySemibold"
            style={{
              ...teamnameStyle,
              color: this.props.isSelected ? globalColors.white : globalColors.darkBlue,
            }}
            title={this.props.teamname}
          >
            {this.props.teamname}
          </Text>
          <Text
            type="Body"
            style={{
              ...channelnameStyle,
              color: this.props.isSelected ? globalColors.white : globalColors.black_75,
            }}
            title={`#${this.props.channelname}`}
          >
            &nbsp;#{this.props.channelname}
          </Text>
        </Box>
      </ClickableBox>
    )
  }
}

const channelnameStyle = platformStyles({
  common: {
    flexBasis: '70%',
  },
  isElectron: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
})
const teamnameStyle = platformStyles({
  common: {
    color: globalColors.darkBlue,
  },
  isElectron: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
})
const filteredRowStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  flexShrink: 0,
  height: 56,
  paddingRight: globalMargins.tiny,
  width: '100%',
}

export {FilterBigTeamChannel}
