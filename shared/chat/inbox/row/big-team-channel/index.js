// @flow
import React, {PureComponent} from 'react'
import {Box, Text, Icon, ClickableBox} from '../../../../common-adapters'
import {globalStyles, globalColors, globalMargins, isMobile, desktopStyles} from '../../../../styles'

type Props = {
  isSelected: boolean,
  channelname: string,
  isMuted: boolean,
  isError: boolean,
  showBold: boolean,
  hasUnread: boolean,
  hasBadge: boolean,
  onSelectConversation: () => void,
}

class BigTeamChannel extends PureComponent<Props> {
  render() {
    return (
      <ClickableBox onClick={this.props.onSelectConversation}>
        <Box style={channelRowContainerStyle}>
          <Box style={this.props.isSelected ? selectedChannelBackgroundStyle : channelBackgroundStyle}>
            <Text
              type={this.props.isSelected ? 'BodySemibold' : 'Body'}
              style={
                this.props.isError
                  ? textStyleError
                  : this.props.isSelected
                    ? this.props.hasUnread ? textStyleSelectedBold : textStyleSelected
                    : this.props.hasUnread ? textStylePlainBold : textStylePlain
              }
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

const textStyleError = {
  color: globalColors.red,
}
const textStylePlain = {
  ...(isMobile ? {backgroundColor: globalColors.fastBlank} : {}),
  color: globalColors.black_75_on_white,
}
const textStylePlainBold = {
  ...textStylePlain,
  ...globalStyles.fontBold,
}
const textStyleSelected = {
  color: globalColors.white,
}
const textStyleSelectedBold = {
  ...textStyleSelected,
  ...globalStyles.fontBold,
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

const mutedStyle = {
  marginLeft: globalMargins.xtiny,
}

const UnreadIcon = () => (
  <Box style={unreadContainerStyle}>
    <Box style={unreadStyle} />
  </Box>
)

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

const teamRowContainerStyle = {
  ...globalStyles.flexBoxRow,
  ...desktopStyles.clickable,
  alignItems: 'center',
  flexShrink: 0,
  maxHeight: isMobile ? globalMargins.large : globalMargins.medium,
  minHeight: isMobile ? globalMargins.large : globalMargins.medium,
  paddingLeft: globalMargins.tiny,
  paddingRight: isMobile ? globalMargins.tiny : globalMargins.xtiny,
}

const channelRowContainerStyle = {
  ...teamRowContainerStyle,
  alignItems: 'stretch',
  paddingRight: 0,
}

const channelBackgroundStyle = {
  ...globalStyles.flexBoxRow,
  ...(isMobile ? globalStyles.fillAbsolute : {width: '100%'}),
  alignItems: 'center',
  marginLeft: globalMargins.medium,
  paddingLeft: globalMargins.tiny,
  paddingRight: globalMargins.tiny,
}

const selectedChannelBackgroundStyle = {
  ...channelBackgroundStyle,
  backgroundColor: globalColors.blue,
}

export {BigTeamChannel}
