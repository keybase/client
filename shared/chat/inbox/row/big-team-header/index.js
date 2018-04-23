// @flow
import React from 'react'
import {Avatar, Box, ClickableBox, Icon, Text} from '../../../../common-adapters'
import {
  desktopStyles,
  collapseStyles,
  globalStyles,
  globalColors,
  globalMargins,
  isMobile,
  platformStyles,
} from '../../../../styles'

type Props = {
  badgeSubscribe: boolean,
  onClickGear: (evt: SyntheticEvent<Element>) => void,
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
        <ClickableBox
          onClick={props.onClickGear}
          style={collapseStyles([globalStyles.flexBoxRow, {position: 'relative'}])}
        >
          <Icon className="icon" type="iconfont-gear" fontSize={iconFontSize} color={globalColors.black_20} />
          <Box
            style={collapseStyles([badgeStyle, props.badgeSubscribe && {backgroundColor: globalColors.blue}])}
          />
        </ClickableBox>
      </Box>
    )
  }
}

const iconFontSize = isMobile ? 20 : 16

const teamRowContainerStyle = platformStyles({
  common: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center',
    flexShrink: 0,
    paddingLeft: globalMargins.tiny,
    paddingRight: globalMargins.tiny,
  },
  isElectron: {
    ...desktopStyles.clickable,
    maxHeight: globalMargins.medium,
    minHeight: globalMargins.medium,
  },
  isMobile: {
    maxHeight: globalMargins.large,
    minHeight: globalMargins.large,
  },
})

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
  borderRadius: 6,
  height: 8,
  top: -1,
  right: isMobile ? -1 : -3,
  position: 'absolute',
  width: 8,
}

export {BigTeamHeader}
