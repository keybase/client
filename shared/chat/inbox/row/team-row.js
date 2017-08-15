// @flow
import React, {PureComponent} from 'react'
import {Avatar, Box, Text, Icon} from '../../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../../styles'
import {isMobile} from '../../../constants/platform'

class TeamRow extends PureComponent<void, {}, void> {
  render() {
    return (
      <Box style={teamRowContainerStyle}>
        <Avatar teamname={this.props.teamname} size={16} />
        <Text type="BodySmallSemibold" style={teamStyle}>{this.props.teamname}</Text>
      </Box>
    )
  }
}

type ChannelProps = {
  isSelected: boolean,
  channelname: string,
  isMuted: boolean,
  showBold: boolean,
  hasUnread: boolean,
}

const MutedIcon = ({isSelected}) => (
  <Icon
    type={
      isSelected
        ? isMobile ? 'icon-shh-active-24' : 'icon-shh-active-16'
        : isMobile ? 'icon-shh-24' : 'icon-shh-16'
    }
    style={mutedStyle}
  />
)

const UnreadIcon = () => (
  <Box style={unreadContainerStyle}>
    <Box style={unreadStyle} />
  </Box>
)

class ChannelRow extends PureComponent<void, ChannelProps, void> {
  render() {
    return (
      <Box style={channelRowContainerStyle}>
        <Box
          style={{
            ...channelBackgroundStyle,
            ...(this.props.isSelected ? {backgroundColor: globalColors.blue} : undefined),
          }}
        >
          <Text
            type={this.props.isSelected ? 'BodySemibold' : 'Body'}
            style={{color: this.props.isSelected ? globalColors.white : globalColors.black_75}}
          >
            {this.props.channelname}
          </Text>
          {this.props.isMuted && <MutedIcon isSelected={this.props.isSelected} />}
          {this.props.hasUnread && <UnreadIcon />}
        </Box>
      </Box>
    )
  }
}

const teamRowContainerStyle = {
  ...globalStyles.flexBoxRow,
  ...globalStyles.clickable,
  alignItems: 'center',
  flexShrink: 0,
  maxHeight: globalMargins.medium,
  minHeight: globalMargins.medium,
  paddingLeft: globalMargins.tiny,
  paddingRight: globalMargins.tiny,
}

const channelRowContainerStyle = {
  ...teamRowContainerStyle,
  alignItems: 'stretch',
  paddingRight: 0,
}

const teamStyle = {
  color: globalColors.darkBlue,
  marginLeft: globalMargins.tiny,
  marginRight: globalMargins.tiny,
}

const channelBackgroundStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  borderRadius: 2,
  marginLeft: 32,
  paddingLeft: globalMargins.tiny,
  paddingRight: globalMargins.tiny,
  width: '100%',
}

const mutedStyle = {
  marginLeft: globalMargins.xtiny,
}

const unreadContainerStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  alignSelf: 'stretch',
  flex: 1,
  justifyContent: 'flex-end',
}
const unreadStyle = {
  backgroundColor: globalColors.orange,
  borderRadius: '50%',
  flexShrink: 0,
  height: 6,
  width: 6,
}
export {TeamRow, ChannelRow}
