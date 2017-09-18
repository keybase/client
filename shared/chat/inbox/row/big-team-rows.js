// @flow
import React, {PureComponent} from 'react'
import {Avatar, Box, Text, Icon, ClickableBox} from '../../../common-adapters'
import {globalStyles, globalColors, globalMargins, glamorous} from '../../../styles'
import {isMobile} from '../../../constants/platform'
import {TeamAvatar} from './avatars'

type TeamProps = {
  teamname: string,
  onShowMenu: () => void,
}

class BigTeamHeaderRow extends PureComponent<TeamProps> {
  render() {
    return (
      <HeaderBox>
        <Avatar teamname={this.props.teamname} size={isMobile ? 24 : 16} />
        <Text type="BodySmallSemibold" style={teamStyle}>{this.props.teamname}</Text>
        <Icon
          className="icon"
          type="iconfont-ellipsis"
          onClick={this.props.onShowMenu}
          style={{
            fontSize: isMobile ? 20 : 16,
            padding: isMobile ? 2 : 0,
          }}
        />
      </HeaderBox>
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
  hasBadge?: boolean,
  onSelectConversation: () => void,
}

class BigTeamChannelRow extends PureComponent<ChannelProps> {
  render() {
    const boldOverride = this.props.hasUnread ? globalStyles.fontBold : null
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
              style={{
                ...boldOverride,
                color: this.props.isSelected ? globalColors.white : globalColors.black_75,
              }}
            >
              #{this.props.channelname}
            </Text>
            {this.props.isMuted && <MutedIcon isSelected={this.props.isSelected} />}
            {this.props.hasBadge && <UnreadIcon />}
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
        <Box
          style={{
            ...filteredRowStyle,
            ...(this.props.isSelected ? {backgroundColor: globalColors.blue} : undefined),
          }}
        >
          <TeamAvatar teamname={this.props.teamname} />
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

const HeaderBox = glamorous(Box)({
  ...teamRowContainerStyle,
  ...(isMobile
    ? {}
    : {
        '& .icon': {
          display: 'none !important',
        },
        ':hover .icon': {
          display: 'inherit !important',
        },
      }),
})

const channelRowContainerStyle = {
  ...teamRowContainerStyle,
  alignItems: 'stretch',
  paddingRight: 0,
}

const teamStyle = {
  color: globalColors.darkBlue,
  flex: 1,
  marginLeft: globalMargins.tiny,
  marginRight: globalMargins.tiny,
}

const channelBackgroundStyle = {
  ...globalStyles.flexBoxRow,
  ...(isMobile ? globalStyles.fillAbsolute : {width: '100%'}),
  alignItems: 'center',
  borderTopLeftRadius: 2,
  borderBottomLeftRadius: 2,
  marginLeft: globalMargins.medium,
  paddingLeft: globalMargins.tiny,
  paddingRight: globalMargins.tiny,
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
  borderRadius: 6,
  flexShrink: 0,
  height: 8,
  width: 8,
}
export {BigTeamHeaderRow, BigTeamChannelRow, BigTeamChannelFilteredRow}
