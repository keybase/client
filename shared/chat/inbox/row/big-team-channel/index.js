// @flow
import React, {PureComponent} from 'react'
import {Box, Text, Icon, ClickableBox} from '../../../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../../../styles'
import {isMobile} from '../../../../constants/platform'

type Props = {
  isSelected?: boolean,
  channelname: string,
  isMuted?: boolean,
  showBold?: boolean,
  hasUnread?: boolean,
  hasBadge?: boolean,
  onSelectConversation: () => void,
}

class BigTeamChannel extends PureComponent<Props> {
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
  ...globalStyles.clickable,
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
  borderBottomLeftRadius: 2,
  borderTopLeftRadius: 2,
  marginLeft: globalMargins.medium,
  paddingLeft: globalMargins.tiny,
  paddingRight: globalMargins.tiny,
}

export {BigTeamChannel}
