// @flow
import Box from './box'
import React from 'react'
import Text from './text'
import {globalStyles, globalColors} from '../styles'

export type Props = {
  badgeNumber: number,
  badgeStyle?: Object,
  badgeNumberStyle?: Object,
}

function Badge ({badgeStyle, badgeNumber, badgeNumberStyle}: Props) {
  return (
    <Box style={{...defaultBadgeStyle, ...badgeStyle}}>
      <Text style={{flex: 0, ...badgeNumberStyle}} type='BadgeNumber'>{badgeNumber}</Text>
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
  marginLeft: 'auto',
  marginRight: 8,
}

export default Badge
