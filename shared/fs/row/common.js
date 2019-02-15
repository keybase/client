// @flow
import * as I from 'immutable'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/fs'
import * as React from 'react'
import * as Kb from '../../common-adapters'
import {OpenInSystemFileManager, PathItemIcon, PathItemAction, SendInAppAction} from '../common'

const rowBox = {
  ...Styles.globalStyles.flexBoxRow,
  alignItems: 'center',
  flex: 1,
  minWidth: 0,
  paddingLeft: Styles.globalMargins.small,
  paddingRight: Styles.globalMargins.small,
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
  lineHeight: undefined, // unset this explicitly otherwise it messes up the badging
}

const leftBoxDisabled = {
  ...leftBox,
  opacity: 0.2,
}

const rightBox = {
  ...Styles.globalStyles.flexBoxRow,
  alignItems: 'center',
  flexShrink: 1,
  justifyContent: 'flex-end',
}

const pathItemActionIcon = {
  padding: Styles.globalMargins.tiny,
}

export const rowStyles = {
  ...Styles.styleSheetCreate({
    itemBox,
    leftBox,
    leftBoxDisabled,
    pathItemActionIcon,
    pathItemIcon,
    pathItemIcon_30,
    rightBox,
    rowBox,
  }),
  // We need to annotate color but I can't figure out how to annotate on stuff
  // from Styles.styleSheetCreate.
  rowText,
  rowText_30,
}

const HoverBox = Styles.isMobile
  ? Kb.Box
  : Styles.styled(Kb.Box)({
      '& .fs-path-item-hover-icon': {color: Styles.globalColors.white},
      '& .fs-path-item-hover-icon:hover': {color: Styles.globalColors.black_50},
      ':hover .fs-path-item-hover-icon': {color: Styles.globalColors.black_50},
    })

export type StillCommonProps = {
  name: string,
  path: Types.Path,
  inDestinationPicker?: boolean,
  onOpen?: ?() => void,
  routePath: I.List<string>,
}

export const StillCommon = (
  props: StillCommonProps & {
    children: React.Node,
    badge?: ?Types.PathItemBadge,
  }
) => (
  <HoverBox style={rowStyles.rowBox}>
    <Kb.ClickableBox
      onClick={props.onOpen}
      style={props.onOpen ? rowStyles.leftBox : rowStyles.leftBoxDisabled}
    >
      <PathItemIcon path={props.path} size={32} style={rowStyles.pathItemIcon} badge={props.badge} />
      {props.children}
    </Kb.ClickableBox>
    {!props.inDestinationPicker && Types.getPathLevel(props.path) > 2 && (
      <Kb.Box style={rowStyles.rightBox}>
        <OpenInSystemFileManager path={props.path} />
        <SendInAppAction path={props.path} sendIconClassName="fs-path-item-hover-icon" />
        <PathItemAction
          path={props.path}
          clickable={{actionIconClassName: 'fs-path-item-hover-icon', type: 'icon'}}
          routePath={props.routePath}
          initView="root"
        />
      </Kb.Box>
    )}
  </HoverBox>
)

export const rowHeight = Styles.isMobile ? 64 : 40
