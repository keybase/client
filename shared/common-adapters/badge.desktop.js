// @flow
import Box from './box'
import * as React from 'react'
import Text from './text'
import {globalStyles, globalColors, platformStyles} from '../styles'

import type {Props} from './badge'

function Badge({badgeStyle, badgeNumber, badgeNumberStyle}: Props) {
  return (
    <Box style={{...defaultBadgeStyle, ...badgeStyle}}>
      <Text style={{...textStyle, ...badgeNumberStyle}} type="HeaderBig">
        {badgeNumber}
      </Text>
    </Box>
  )
}

const defaultBadgeStyle = {
  ...globalStyles.flexBoxRow,
  backgroundColor: globalColors.orange,
  borderRadius: 10,
  alignItems: 'center',
  height: 16,
  justifyContent: 'center',
  paddingLeft: 4,
  paddingRight: 5,
  marginLeft: 'auto',
  marginRight: 8,
  minWidth: 16,
}

const textStyle = platformStyles({
  isElectron: {
    flex: 0,
    lineHeight: '8px',
    fontSize: 9,
    color: globalColors.white,
  },
})

export default Badge
