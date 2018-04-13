// @flow
import React from 'react'
import {Avatar, Box, Text, Icon} from '../../../../common-adapters'
import {
  globalStyles,
  globalColors,
  globalMargins,
  glamorous,
  isMobile,
  desktopStyles,
  platformStyles,
} from '../../../../styles'

type Props = {
  onClickGear: (evt?: SyntheticEvent<Element>) => void,
  memberCount: number,
  teamname: string,
}

class BigTeamHeader extends React.PureComponent<Props> {
  render() {
    const props = this.props

    return (
      <HeaderBox>
        <Avatar teamname={props.teamname} size={isMobile ? 24 : 16} />
        <Text type="BodySmallSemibold" style={teamStyle}>
          {props.teamname}
        </Text>
        <Icon
          className="icon"
          type="iconfont-gear"
          onClick={isMobile ? () => props.onClickGear() : props.onClickGear}
          style={iconStyle}
          hoverColor={isMobile ? undefined : globalColors.black_75}
        />
      </HeaderBox>
    )
  }
}

const iconStyle = platformStyles({
  common: {
    color: globalColors.black_20,
    padding: 4,
  },
  isMobile: {
    backgroundColor: globalColors.fastBlank,
    fontSize: 20,
  },
  isElectron: {
    fontSize: 16,
  },
})

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
  flexGrow: 1,
  marginLeft: globalMargins.tiny,
  marginRight: globalMargins.tiny,
  ...(isMobile
    ? {
        backgroundColor: globalColors.fastBlank,
      }
    : {}),
}

export {BigTeamHeader}
