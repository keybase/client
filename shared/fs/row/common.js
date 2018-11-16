// @flow
import * as Styles from '../../styles'
import * as Types from '../../constants/types/fs'
import * as React from 'react'
import {Box, Box2, ClickableBox} from '../../common-adapters'
import {PathItemIcon, PathItemAction, OpenInSystemFileManager} from '../common'

const rowBox = {
  ...Styles.globalStyles.flexBoxRow,
  alignItems: 'center',
  flex: 1,
  minWidth: 0,
  paddingRight: Styles.globalMargins.small,
  paddingLeft: Styles.globalMargins.small,
}

const itemBox = {
  ...Styles.globalStyles.flexBoxColumn,
  flex: 1,
  justifyContent: 'center',
  minWidth: 0,
  width: 0,
}

const pathItemIcon = {
  marginRight: Styles.globalMargins.small,
}

const pathItemIcon_30 = {
  marginRight: Styles.globalMargins.small,
  opacity: 0.3,
}

const rowText = Styles.platformStyles({
  isElectron: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  isMobile: {
    flexShrink: 1,
  },
})

const rowText_30 = Styles.platformStyles({
  common: {
    opacity: 0.3,
  },
  isElectron: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
})

const leftBox = {
  ...Styles.globalStyles.flexBoxRow,
  flex: 1,
}

const leftBoxDisabled = {
  ...leftBox,
  opacity: 0.2,
}

const rightBox = {
  ...Styles.globalStyles.flexBoxRow,
  flexShrink: 1,
  justifyContent: 'flex-end',
  alignItems: 'center',
}

const pathItemActionIcon = {
  padding: Styles.globalMargins.tiny,
}

const badgeContainer = {
  position: 'absolute',
  left: Styles.isMobile ? -28 : 24,
  top: Styles.isMobile ? -4 : -1,
  zIndex: 200,
}

const badgeContainerNew = {
  ...badgeContainer,
  left: Styles.isMobile ? -32 : 16,
}

const badgeContainerRekey = {
  ...badgeContainer,
  top: Styles.isMobile ? 5 : 24,
  left: Styles.isMobile ? -40 : 16,
}

const downloadContainer = {
  ...badgeContainer,
  top: Styles.isMobile ? 2 : 22,
  left: Styles.isMobile ? -28 : 20,
}

const badgeCount = {
  marginLeft: 0,
  marginRight: 0,
}

export const rowStyles = {
  ...Styles.styleSheetCreate({
    rowBox,
    itemBox,
    pathItemIcon,
    pathItemIcon_30,
    leftBox,
    leftBoxDisabled,
    rightBox,
    pathItemActionIcon,
    badgeContainer,
    badgeContainerNew,
    badgeContainerRekey,
    downloadContainer,
    badgeCount,
  }),
  // We need to annotate color but I can't figure out how to annotate on stuff
  // from Styles.styleSheetCreate.
  rowText,
  rowText_30,
}

const HoverBox = Styles.isMobile
  ? Box
  : Styles.glamorous(Box)({
      '& .fs-path-item-hover-icon': {
        color: Styles.globalColors.white,
      },
      ':hover .fs-path-item-hover-icon': {
        color: Styles.globalColors.black_40,
      },
      '& .fs-path-item-hover-icon:hover': {
        color: Styles.globalColors.black_60,
      },
    })

export type StillCommonProps = {
  itemStyles: Types.ItemStyles,
  name: string,
  path: Types.Path,
  inDestinationPicker?: boolean,
  onOpen?: ?() => void,
}

export const StillCommon = (
  props: StillCommonProps & {
    children: React.Node,
  }
) => (
  <HoverBox style={rowStyles.rowBox}>
    <ClickableBox onClick={props.onOpen} style={props.onOpen ? rowStyles.leftBox : rowStyles.leftBoxDisabled}>
      <Box2 direction="vertical">
        <PathItemIcon spec={props.itemStyles.iconSpec} style={rowStyles.pathItemIcon} />
      </Box2>
      {props.children}
    </ClickableBox>
    {!props.inDestinationPicker && (
      <Box style={rowStyles.rightBox}>
        <OpenInSystemFileManager path={props.path} />
        <PathItemAction path={props.path} actionIconClassName="fs-path-item-hover-icon" />
      </Box>
    )}
  </HoverBox>
)

export const rowHeight = Styles.isMobile ? 64 : 40
