// @flow
import Box from './box'
import * as React from 'react'
import Text from './text'
import {globalStyles, globalColors, styleSheetCreate, collapseStyles} from '../styles'

import type {Props} from './badge'

function Badge({badgeStyle, badgeNumber, badgeNumberStyle, largerBadgeMinWidthFix}: Props) {
  return (
    <Box
      style={collapseStyles([
        styles.badge,
        largerBadgeMinWidthFix && styles.largerBadgeMinWidthFix,
        badgeStyle,
      ])}
    >
      <Text style={collapseStyles([styles.text, badgeNumberStyle])} type="HeaderBig">
        {badgeNumber}
      </Text>
    </Box>
  )
}

const styles = styleSheetCreate({
  badge: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center',
    backgroundColor: globalColors.orange,
    borderRadius: 14,
    flex: 0,
    justifyContent: 'center',
    paddingBottom: 2,
    paddingLeft: 6,
    paddingRight: 6,
    paddingTop: 4,
  },
  largerBadgeMinWidthFix: {
    minWidth: 24.5,
    paddingLeft: 4,
    paddingRight: 4,
  },
  text: {
    color: globalColors.white,
    flex: 0,
    fontSize: 11,
    lineHeight: 12,
  },
})

export default Badge
