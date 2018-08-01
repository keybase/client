// @flow
import {
  globalStyles,
  globalMargins,
  globalColors,
  platformStyles,
  glamorous,
  styleSheetCreate,
  isMobile,
} from '../../styles'
import * as Types from '../../constants/types/fs'
import * as React from 'react'
import {Box, Box2, ClickableBox, Icon} from '../../common-adapters'
import PathItemIcon from '../common/path-item-icon'
import PathItemAction from '../common/path-item-action-container'

const rowBox = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  flex: 1,
  minWidth: 0,
  paddingRight: globalMargins.small,
  paddingLeft: globalMargins.small,
}

const itemBox = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  justifyContent: 'center',
  minWidth: 0,
  width: 0,
}

const pathItemIcon = {
  marginRight: globalMargins.small,
}

const pathItemIcon_30 = {
  marginRight: globalMargins.small,
  opacity: 0.3,
}

const rowText = platformStyles({
  isElectron: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
})

const rowText_30 = platformStyles({
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
  ...globalStyles.flexBoxRow,
  flex: 1,
}

const rightBox = {
  ...globalStyles.flexBoxRow,
  flexShrink: 1,
  justifyContent: 'flex-end',
  alignItems: 'center',
}

const pathItemActionIcon = {
  padding: globalMargins.tiny,
}

const badgeContainer = {
  position: 'absolute',
  left: isMobile ? -24 : 24,
  top: isMobile ? -20 : -1,
  zIndex: 200,
}

const badgeContainerNew = {
  ...badgeContainer,
  left: isMobile ? -32 : 16,
}

const badgeContainerRekey = {
  ...badgeContainer,
  top: isMobile ? 5 : 24,
  left: isMobile ? -40 : 16,
}

const downloadContainer = {
  ...badgeContainer,
  top: isMobile ? 2 : 22,
  left: isMobile ? -28 : 20,
}

const badgeCount = {
  marginLeft: 0,
  marginRight: 0,
}

export const rowStyles = {
  ...styleSheetCreate({
    rowBox,
    itemBox,
    pathItemIcon,
    pathItemIcon_30,
    leftBox,
    rightBox,
    pathItemActionIcon,
    badgeContainer,
    badgeContainerNew,
    badgeContainerRekey,
    downloadContainer,
    badgeCount,
  }),
  // We need to annotate color but I can't figure out how to annotate on stuff
  // from styleSheetCreate.
  rowText,
  rowText_30,
}

const HoverBox = isMobile
  ? Box
  : glamorous(Box)({
      '& .fs-path-item-hover-icon': {
        color: globalColors.white,
      },
      ':hover .fs-path-item-hover-icon': {
        color: globalColors.black_40,
      },
      '& .fs-path-item-hover-icon:hover': {
        color: globalColors.black_60,
      },
    })

export type StillCommonProps = {
  itemStyles: Types.ItemStyles,
  name: string,
  path: Types.Path,
  onOpen: () => void,
  openInFileUI: () => void,
}

export const StillCommon = (
  props: StillCommonProps & {
    children: React.Node,
  }
) => (
  <HoverBox style={rowStyles.rowBox}>
    <ClickableBox onClick={props.onOpen} style={rowStyles.leftBox}>
      <Box2 direction="vertical">
        <PathItemIcon spec={props.itemStyles.iconSpec} style={rowStyles.pathItemIcon} />
      </Box2>
      {props.children}
    </ClickableBox>
    <Box style={rowStyles.rightBox}>
      {!isMobile && (
        <Icon
          type="iconfont-finder"
          style={rowStyles.pathItemActionIcon}
          fontSize={16}
          onClick={props.openInFileUI}
          className="fs-path-item-hover-icon"
        />
      )}
      <PathItemAction path={props.path} actionIconClassName="fs-path-item-hover-icon" />
    </Box>
  </HoverBox>
)
