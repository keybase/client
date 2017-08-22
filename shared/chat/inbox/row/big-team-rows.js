// @flow
import React, {PureComponent} from 'react'
import {Avatar, Box, Text, Icon, ClickableBox} from '../../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../../styles'
import {isMobile} from '../../../constants/platform'
import {TeamAvatar} from './avatars'

type TeamProps = {
  teamname: string,
}

class BigTeamHeaderRow extends PureComponent<TeamProps> {
  render() {
    return (
      <Box style={teamRowContainerStyle}>
        <Avatar teamname={this.props.teamname} size={isMobile ? 24 : 16} />
        <Text type="BodySmallSemibold" style={teamStyle}>{this.props.teamname}</Text>
      </Box>
    )
  }
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

type ChannelProps = {
  isSelected?: boolean,
  channelname: string,
  isMuted?: boolean,
  showBold?: boolean,
  hasUnread?: boolean,
  onSelectConversation: () => void,
}

class BigTeamChannelRow extends PureComponent<ChannelProps> {
  render() {
    return (
      <ClickableBox onClick={this.props.onSelectConversation}>
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
      </ClickableBox>
    )
  }
}

type FilteredChannelProps = {
  teamname: string,
  channelname: string,
  onSelectConversation: () => void,
}

class BigTeamChannelFilteredRow extends PureComponent<FilteredChannelProps> {
  render() {
    return (
      <ClickableBox onClick={this.props.onSelectConversation}>
        <Box style={filteredRowStyle}>
          <TeamAvatar teamname={this.props.teamname} />
          <Text type="BodySemibold" style={teamnameStyle} title={this.props.teamname}>
            {this.props.teamname}
          </Text>
          <Text type="Body" style={channelnameStyle} title={`#${this.props.channelname}`}>
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

const teamRowContainerStyle = {
  ...globalStyles.flexBoxRow,
  ...globalStyles.clickable,
  alignItems: 'center',
  flexShrink: 0,
  maxHeight: isMobile ? globalMargins.large : globalMargins.medium,
  minHeight: isMobile ? globalMargins.large : globalMargins.medium,
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
export {BigTeamHeaderRow, BigTeamChannelRow, BigTeamChannelFilteredRow}
