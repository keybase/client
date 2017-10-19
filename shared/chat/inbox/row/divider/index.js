// @flow
import * as React from 'react'
import {ClickableBox, Box, Text, Badge} from '../../../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../../../styles'
import {isMobile} from '../../../../constants/platform'

type Props = {
  badgeCount: number,
  hiddenCount: number,
  toggle: () => void,
}

const Divider = ({badgeCount, hiddenCount, toggle}: Props) => (
  <Box style={_toggleContainer}>
    <ClickableBox onClick={toggle} style={_toggleButtonStyle} className="toggleButtonClass">
      <Text type="BodySmallSemibold" style={{color: globalColors.black_60}}>
        {hiddenCount > 0 ? `+${hiddenCount} more` : 'Show less'}
      </Text>
      {hiddenCount > 0 && badgeCount > 0 && <Badge badgeStyle={_badgeToggleStyle} badgeNumber={badgeCount} />}
    </ClickableBox>
  </Box>
)

const _toggleButtonStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  alignSelf: 'center',
  backgroundColor: globalColors.black_05,
  borderRadius: 19,
  height: isMobile ? 28 : 20,
  marginBottom: isMobile ? 16 : 8,
  paddingLeft: isMobile ? globalMargins.small : globalMargins.tiny,
  paddingRight: isMobile ? globalMargins.small : globalMargins.tiny,
}

const _badgeStyle = {
  marginLeft: globalMargins.xtiny,
  marginRight: 0,
  position: 'relative',
}

const _toggleContainer = {
  ...globalStyles.flexBoxColumn,
  borderBottomColor: globalColors.black_05,
  borderBottomWidth: 1,
  borderStyle: 'solid',
  height: isMobile ? 56 : 40,
  justifyContent: 'center',
}

const _badgeToggleStyle = {
  ..._badgeStyle,
  marginLeft: globalMargins.xtiny,
}

export {Divider}
