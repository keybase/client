// @flow
import React from 'react'
import {Avatar, Box, ClickableBox, Icon, Text} from '../../../../common-adapters'
import {type FloatingMenuParentProps, FloatingMenuParentHOC} from '../../../../common-adapters/floating-menu'
import TeamMenu from '../../../conversation/info-panel/menu/container'
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
  memberCount: number,
  teamname: string,
} & FloatingMenuParentProps

class _BigTeamHeader extends React.PureComponent<Props> {
  render() {
    const props = this.props

    return (
      <Box style={teamRowContainerStyle}>
        <TeamMenu
          attachTo={props.attachmentRef}
          visible={props.showingMenu}
          onHidden={props.toggleShowingMenu}
          teamname={props.teamname}
          isSmallTeam={false}
        />
        <Avatar teamname={props.teamname} size={32} />
        <Text type="BodySmallSemibold" style={teamStyle}>
          {props.teamname}
        </Text>
        <ClickableBox
          onClick={props.toggleShowingMenu}
          ref={props.setAttachmentRef}
          style={collapseStyles([
            globalStyles.flexBoxRow,
            {position: 'relative', right: globalMargins.xtiny},
          ])}
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

const BigTeamHeader = FloatingMenuParentHOC(_BigTeamHeader)

const iconFontSize = isMobile ? 20 : 16

const teamRowContainerStyle = platformStyles({
  common: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center',
    flexShrink: 0,
    maxHeight: 32,
    minHeight: 32,
    paddingLeft: globalMargins.tiny,
    paddingRight: globalMargins.tiny,
  },
  isElectron: {
    ...desktopStyles.clickable,
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
