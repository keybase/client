// @flow
import * as React from 'react'
import {ClickableBox, Icon, Box, Text, Badge} from '../../../common-adapters'
import {globalStyles, globalColors, globalMargins, glamorous} from '../../../styles'
import {isMobile} from '../../../constants/platform'

type DividerProps = {
  isExpanded: boolean,
  isBadged: boolean,
  toggle: () => void,
}

const DividerBox = glamorous(Box)({
  ...globalStyles.flexBoxRow,
  ...(isMobile
    ? {}
    : {
        ':hover': {
          borderBottomColor: globalColors.black_10,
          borderTopColor: globalColors.black_10,
          color: globalColors.black_40,
        },
        color: globalColors.black_20,
      }),
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
})

const Divider = ({isExpanded, isBadged, toggle}: DividerProps) => (
  <ClickableBox
    onClick={toggle}
    style={_dividerStyle}
    className={isExpanded ? 'smallTeamsDividerExpanded' : ''}
  >
    <DividerBox>
      <Box style={_dividerIconStyle}>
        <Icon type={isExpanded ? 'iconfont-up-arrow' : 'iconfont-down-arrow'} inheritColor={true} />
      </Box>
    </DividerBox>
  </ClickableBox>
)

type FloatingDividerProps = {
  badgeCount: number,
  toggle: () => void,
}

const FloatingDivider = ({toggle, badgeCount}: FloatingDividerProps) => (
  <ClickableBox onClick={toggle} style={_floatingStyle}>
    <DividerBox>
      <BigTeamsLabel isFiltered={false} />
      {badgeCount > 0 && <Badge badgeStyle={_badgeStyle} badgeNumber={badgeCount} />}
      <Box style={_iconStyle}>
        <Icon type="iconfont-up-arrow" inheritColor={true} />
      </Box>
    </DividerBox>
  </ClickableBox>
)

const BigTeamsLabel = ({isFiltered}: {isFiltered: boolean}) => (
  <Box style={_bigTeamsLabelBox}>
    <Text type="BodySmallSemibold">{isFiltered ? 'Teams' : 'Big teams'}</Text>
  </Box>
)

const _bigTeamsLabelBox = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  minHeight: 24,
}

const _iconStyle = {
  ...globalStyles.fillAbsolute,
  ...globalStyles.flexBoxRow,
  alignItems: 'flex-start',
  justifyContent: 'center',
}

const _dividerIconStyle = {
  ..._iconStyle,
  alignItems: 'center',
}

const _badgeStyle = {
  marginRight: 0,
}

const _dividerStyle = {
  flexShrink: 0,
  height: isMobile ? 25 : 16,
}

const _floatingStyle = {
  ...globalStyles.fillAbsolute,
  backgroundColor: globalColors.white,
  flexShrink: 0,
  height: 32,
  top: undefined,
}

export {Divider, FloatingDivider, BigTeamsLabel}
