// @flow
import Box from './box'
import * as React from 'react'
import Text from './text'
import {collapseStyles, globalStyles, globalColors} from '../styles'

import type {Props} from './badge'

function Badge({badgeStyle, badgeNumber, badgeNumberStyle}: Props) {
  return (
    <Box style={collapseStyles([defaultBadgeStyle, badgeStyle])}>
      <Text style={collapseStyles([textStyle, badgeNumberStyle])} type="HeaderBig">
        {badgeNumber}
      </Text>
    </Box>
  )
}

const defaultBadgeStyle = {
  ...globalStyles.flexBoxRow,
  backgroundColor: globalColors.orange,
  borderRadius: 14,
  flex: 0,
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 24.5,
  paddingLeft: 4,
  paddingRight: 4,
  paddingTop: 4,
  paddingBottom: 2,
}

const textStyle = {
  flex: 0,
  lineHeight: 12,
  fontSize: 11,
  color: globalColors.white,
}

export default Badge
