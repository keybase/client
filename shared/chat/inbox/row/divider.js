// @flow
import * as React from 'react'
import {ClickableBox, Icon, Box, Text, Badge} from '../../../common-adapters'
import {globalStyles, globalColors, globalMargins, glamorous} from '../../../styles'
import {isMobile} from '../../../constants/platform'

type DividerProps = {
  badgeCount: number,
  hiddenCount: number,
  isExpanded: boolean,
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
  justifyContent: 'flex-start',
  paddingLeft: globalMargins.tiny,
  paddingRight: globalMargins.tiny,
  position: 'relative',
  width: '100%',
})

const Divider = ({badgeCount, hiddenCount, isExpanded, toggle}: DividerProps) => (
  <Box style={_toggleContainer}>
    <ClickableBox onClick={toggle} style={_toggleButtonStyle} className="toggleButtonClass">
      <Text type="BodySmallSemibold">{hiddenCount ? `+${hiddenCount} more` : 'Show less'}</Text>
      {badgeCount > 0 && !isExpanded && <Badge badgeStyle={_badgeToggleStyle} badgeNumber={badgeCount} />}
    </ClickableBox>
  </Box>
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
        <Icon type="iconfont-up-arrow" inheritColor={true} style={{fontSize: isMobile ? 20 : 16}} />
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
  marginTop: isMobile ? globalMargins.tiny : 0,
}

const _badgeStyle = {
  marginLeft: globalMargins.xtiny,
  marginRight: 0,
  position: 'relative',
}

const _badgeToggleStyle = {
  ..._badgeStyle,
  marginLeft: globalMargins.xtiny,
}

const _toggleButtonStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  alignSelf: 'center',
  backgroundColor: globalColors.black_05,
  borderRadius: 19,
  color: globalColors.black_60,
  height: isMobile ? 24 : 20,
  marginBottom: isMobile ? 16 : 8,
  paddingLeft: isMobile ? globalMargins.small : globalMargins.tiny,
  paddingRight: isMobile ? globalMargins.small : globalMargins.tiny,
}

const _toggleContainer = {
  ...globalStyles.flexBoxColumn,
  borderBottomColor: globalColors.black_05,
  borderBottomWidth: 1,
  borderStyle: 'solid',
  height: isMobile ? 56 : 40,
  justifyContent: 'center',
}

const _floatingStyle = {
  ...globalStyles.fillAbsolute,
  backgroundColor: isMobile ? globalColors.white : globalColors.blue5,
  flexShrink: 0,
  height: isMobile ? 56 : 32,
  top: undefined,
}

export {Divider, FloatingDivider, BigTeamsLabel}
