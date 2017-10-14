// @flow
import React, {PureComponent} from 'react'
import {Avatar, Box, Text, Icon} from '../../../../common-adapters'
import {globalStyles, globalColors, globalMargins, glamorous} from '../../../../styles'
import {isMobile} from '../../../../constants/platform'

type Props = {
  teamname: string,
  onShowMenu: () => void,
}

class BigTeamHeaderRow extends PureComponent<Props> {
  render() {
    return (
      <HeaderBox>
        <Avatar teamname={this.props.teamname} size={isMobile ? 24 : 16} />
        <Text type="BodySmallSemibold" style={teamStyle}>{this.props.teamname}</Text>
        <Icon className="icon" type="iconfont-ellipsis" onClick={this.props.onShowMenu} style={iconStyle} />
      </HeaderBox>
    )
  }
}

const iconStyle = {
  fontSize: isMobile ? 20 : 16,
  padding: isMobile ? 8 : 4,
  paddingRight: isMobile ? 2 : 4,
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

const teamStyle = {
  color: globalColors.darkBlue,
  flex: 1,
  marginLeft: globalMargins.tiny,
  marginRight: globalMargins.tiny,
}

export default BigTeamHeaderRow
