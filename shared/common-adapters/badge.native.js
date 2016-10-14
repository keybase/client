// @flow
import Box from './box'
import React from 'react'
import Text from './text'
import {globalStyles, globalColors} from '../styles'

import type {Props} from './badge'

function Badge ({badgeStyle, badgeNumber, badgeNumberStyle}: Props) {
  return (
    <Box style={{...defaultBadgeStyle, ...badgeStyle}}>
      <Text style={{...textStyle, ...badgeNumberStyle}} type='HeaderBig'>{badgeNumber}</Text>
    </Box>
  )
}

const defaultBadgeStyle = {
  ...globalStyles.flexBoxRow,
  backgroundColor: globalColors.orange,
  borderColor: globalColors.orange,
  borderWidth: 2,
  paddingLeft: 5,
  paddingRight: 5,
  borderRadius: 10,
  flex: 0,
  marginRight: 8,
}

const textStyle = {
  flex: 0,
  lineHeight: 10,
  fontSize: 9,
  color: globalColors.white,
}

export default Badge
