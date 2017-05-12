// @flow
import Box from './box'
import React from 'react'
import Text from './text'
import {globalStyles, globalColors} from '../styles'

import type {Props} from './badge'

function Badge({
  badgeStyle,
  badgeNumber,
  badgeNumberStyle,
  outlineColor,
}: Props) {
  const outlineStyle = outlineColor
    ? {borderWidth: 3, borderColor: outlineColor}
    : {}
  return (
    <Box style={{...defaultBadgeStyle, ...badgeStyle, ...outlineStyle}}>
      <Text style={{...textStyle, ...badgeNumberStyle}} type="HeaderBig">
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
  paddingLeft: 5,
  paddingRight: 5,
  paddingTop: 2,
  paddingBottom: 2,
}

const textStyle = {
  flex: 0,
  lineHeight: 13,
  fontSize: 11,
  color: globalColors.white,
}

export default Badge
