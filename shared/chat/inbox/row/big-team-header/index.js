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
  styleSheetCreate,
} from '../../../../styles'
import * as RowSizes from '../sizes'

type Props = {
  badgeSubscribe: boolean,
  memberCount: number,
  onClick: () => void,
  teamname: string,
} & FloatingMenuParentProps

class _BigTeamHeader extends React.PureComponent<Props> {
  render() {
    const props = this.props

    return (
      <Box style={styles.teamRowContainer}>
        <TeamMenu
          attachTo={props.attachmentRef}
          visible={props.showingMenu}
          onHidden={props.toggleShowingMenu}
          teamname={props.teamname}
          isSmallTeam={false}
        />
        <Avatar onClick={props.onClick} teamname={props.teamname} size={32} />
        <Text onClick={props.onClick} type="BodySmallSemibold" style={styles.team}>
          {props.teamname}
        </Text>
        <ClickableBox onClick={props.toggleShowingMenu} ref={props.setAttachmentRef} style={styles.showMenu}>
          <Icon className="icon" type="iconfont-gear" fontSize={iconFontSize} color={globalColors.black_20} />
          <Box
            style={collapseStyles([
              styles.badge,
              props.badgeSubscribe && {backgroundColor: globalColors.blue},
            ])}
          />
        </ClickableBox>
      </Box>
    )
  }
}

const BigTeamHeader = FloatingMenuParentHOC(_BigTeamHeader)
const iconFontSize = isMobile ? 20 : 16

const styles = styleSheetCreate({
  badge: {
    borderRadius: 6,
    height: 8,
    position: 'absolute',
    right: isMobile ? -1 : -3,
    top: -1,
    width: 8,
  },
  showMenu: {
    ...globalStyles.flexBoxRow,
    position: 'relative',
    right: globalMargins.xtiny,
  },
  team: platformStyles({
    common: {
      color: globalColors.darkBlue,
      flexGrow: 1,
      marginLeft: globalMargins.tiny,
      marginRight: globalMargins.tiny,
    },
    isMobile: {backgroundColor: globalColors.fastBlank},
  }),
  teamRowContainer: platformStyles({
    common: {
      ...globalStyles.flexBoxRow,
      alignItems: 'center',
      flexShrink: 0,
      height: RowSizes.bigHeaderHeight,
      paddingLeft: globalMargins.tiny,
      paddingRight: globalMargins.tiny,
    },
    isElectron: desktopStyles.clickable,
  }),
})

export {BigTeamHeader}
