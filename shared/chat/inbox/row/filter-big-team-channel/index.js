// @flow
import React, {PureComponent} from 'react'
import {Box, Text, ClickableBox} from '../../../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../../../styles'
import {isMobile} from '../../../../constants/platform'
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
              color: this.props.isSelected ? globalColors.white : globalColors.black_75,
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

const channelnameStyle = {
  flexBasis: '70%',
  ...(isMobile
    ? {}
    : {
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }),
}
const teamnameStyle = {
  color: globalColors.darkBlue,
  ...(isMobile
    ? {}
    : {
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }),
}

const filteredRowStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  flexShrink: 0,
  height: 56,
  paddingRight: globalMargins.tiny,
  width: '100%',
}

export {FilterBigTeamChannel}
