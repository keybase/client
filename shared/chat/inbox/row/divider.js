// @flow
import * as React from 'react'
import {ClickableBox, Icon, Box, Text, Badge} from '../../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../../styles'

type DividerProps = {
  isExpanded: boolean,
  isBadged: boolean,
  toggle: () => void,
}

// TODO hover color

const Divider = ({isExpanded, isBadged, toggle}: DividerProps) => (
  <ClickableBox
    onClick={toggle}
    style={_dividerStyle}
    className={isExpanded ? 'smallTeamsDividerExpanded' : ''}
  >
    <Box style={_boxStyle}>
      <Box style={_iconStyle}>
        <Icon type={isExpanded ? 'iconfont-keybase' : 'iconfont-down-arrow'} />
      </Box>
    </Box>
  </ClickableBox>
)

type FloatingDividerProps = {
  badgeCount: number,
  toggle: () => void,
}

const FloatingDivider = ({toggle, badgeCount}: FloatingDividerProps) => (
  <ClickableBox onClick={toggle} style={_floatingStyle}>
    <Box style={_boxStyle}>
      <BigTeamsLabel />
      {badgeCount > 0 && <Badge badgeStyle={_badgeStyle} badgeNumber={badgeCount} />}
      <Box style={_iconStyle}>
        <Icon type="iconfont-keybase" />
      </Box>
    </Box>
  </ClickableBox>
)

const BigTeamsLabel = () => (
  <Box style={_bigTeamsLabelBox}>
    <Text type="BodySmallSemibold">Big teams</Text>
  </Box>
)

const _bigTeamsLabelBox = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  minHeight: 24,
}

const _boxStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  borderBottomColor: globalColors.black_05,
  borderBottomWidth: 1,
  borderLeftWidth: 0,
  borderRightWidth: 0,
  borderStyle: 'solid',
  borderTopColor: globalColors.black_05,
  borderTopWidth: 1,
  height: '100%',
  justifyContent: 'space-between',
  paddingLeft: globalMargins.tiny,
  paddingRight: globalMargins.tiny,
  position: 'relative',
  width: '100%',
}

const _iconStyle = {
  ...globalStyles.fillAbsolute,
  ...globalStyles.flexBoxRow,
  alignItems: 'flex-start',
  justifyContent: 'center',
}

const _badgeStyle = {
  marginRight: 0,
}

const _dividerStyle = {
  height: 16,
  flexShrink: 0,
}

const _floatingStyle = {
  ...globalStyles.fillAbsolute,
  backgroundColor: globalColors.white,
  flexShrink: 0,
  height: 32,
  top: undefined,
}

export {Divider, FloatingDivider, BigTeamsLabel}
