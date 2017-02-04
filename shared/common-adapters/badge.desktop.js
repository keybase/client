// @flow
import Box from './box'
import React from 'react'
import Text from './text'
import {globalStyles, globalColors} from '../styles'

import type {Props} from './badge'

function Badge ({badgeStyle, badgeNumber, badgeNumberStyle, outlineColor}: Props) {
  const styleOutline = {minWidth: 18, height: 18, border: `2px solid ${outlineColor}`}
  const styleNoOutline = {minWidth: 14, height: 14, border: 'none'}
  const outlineStyle = outlineColor !== null ? styleOutline : styleNoOutline;
  return (
    <Box style={{...defaultBadgeStyle, ...badgeStyle, ...outlineStyle}}>
      <Text style={{...textStyle, ...badgeNumberStyle}} type='HeaderBig'>{badgeNumber}</Text>
    </Box>
  )
}

const defaultBadgeStyle = {
  ...globalStyles.flexBoxRow,
  backgroundColor: globalColors.orange,
  borderRadius: 10,
  flex: 0,
  alignItems: 'center',
  justifyContent: 'center',
  paddingLeft: 4,
  paddingRight: 4,
  marginLeft: 'auto',
  marginRight: 8,
}

const textStyle = {
  flex: 0,
  lineHeight: '8px',
  fontSize: 9,
  color: globalColors.white,
}

export default Badge
