// @flow
import React from 'react'
import {Avatar, Box, Text, Icon} from '../../../../common-adapters'
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
          fontSize={iconFontSize}
          hoverColor={isMobile ? undefined : globalColors.black_75}
          color={globalColors.black_20}
        />
        <Box
          style={
            props.badgeSubscribe
              ? collapseStyles([badgeStyle, {backgroundColor: globalColors.orange}])
              : badgeStyle
          }
        />
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
  },
  isElectron: {
    ...desktopStyles.clickable,
    maxHeight: globalMargins.medium,
    minHeight: globalMargins.medium,
    paddingRight: globalMargins.xtiny,
  },
  isMobile: {
    maxHeight: globalMargins.large,
    minHeight: globalMargins.large,
    paddingRight: 0,
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
  marginTop: 4,
  marginRight: 4,
  width: 8,
}

export {BigTeamHeader}
