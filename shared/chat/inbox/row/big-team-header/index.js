// @flow
import React from 'react'
import {Avatar, Box, Text, Icon} from '../../../../common-adapters'
import {
  desktopStyles,
  globalStyles,
  globalColors,
  globalMargins,
  isMobile,
} from '../../../../styles'

type Props = {
  badgeSubscribe: boolean,
  onClickGear: (evt?: SyntheticEvent<Element>) => void,
  memberCount: number,
  teamname: string,
}

class BigTeamHeader extends React.PureComponent<Props> {
  render() {
    const props = this.props

    return (
      <Box style={teamRowContainerStyle}>
        <Avatar teamname={props.teamname} size={isMobile ? 24 : 16} />
        <Text type="BodySmallSemibold" style={teamStyle}>
          {props.teamname}
        </Text>
        <Icon
          className="icon"
          type="iconfont-gear"
          onClick={isMobile ? () => props.onClickGear() : props.onClickGear}
          style={iconStyle}
        />
        {props.badgeSubscribe && <Box style={badgeStyle} />}
      </Box>
    )
  }
}

const teamRowContainerStyle = {
  ...globalStyles.flexBoxRow,
  ...desktopStyles.clickable,
  alignItems: 'center',
  flexShrink: 0,
  maxHeight: isMobile ? globalMargins.large : globalMargins.medium,
  minHeight: isMobile ? globalMargins.large : globalMargins.medium,
  paddingLeft: globalMargins.tiny,
  paddingRight: isMobile ? 0 : globalMargins.xtiny,
}

const iconStyle = {
  color: globalColors.black_20,
  fontSize: isMobile ? 20 : 16,
}

const teamStyle = {
  color: globalColors.darkBlue,
  flexGrow: 1,
  marginLeft: globalMargins.tiny,
  marginRight: globalMargins.tiny,
  ...(isMobile
    ? {
        backgroundColor: globalColors.fastBlank,
      }
    : {}),
}

const badgeStyle = {
  backgroundColor: globalColors.orange,
  borderRadius: 6,
  height: 8,
  marginTop: 4,
  marginRight: 4,
  width: 8,
}

export {BigTeamHeader}
