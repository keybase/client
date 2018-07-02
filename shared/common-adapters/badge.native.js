// @flow
import Box from './box'
import * as React from 'react'
import Text from './text'
import {globalStyles, globalColors, styleSheetCreate, collapseStyles} from '../styles'

import type {BadgeProps, Badge2Props} from './badge'

export function Badge({badgeStyle, badgeNumber, badgeNumberStyle, largerBadgeMinWidthFix}: Props) {
  return (
    <Box
      style={collapseStyles([
        badgeStyles.badge,
        largerBadgeMinWidthFix && badgeStyles.largerBadgeMinWidthFix,
        badgeStyle,
      ])}
    >
      <Text style={collapseStyles([badgeStyles.text, badgeNumberStyle])} type="HeaderBig">
        {badgeNumber}
      </Text>
    </Box>
  )
}

const badgeStyles = styleSheetCreate({
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

export function Badge2({number, radius, fontSize, style, numberStyle}: Badge2Props) {
  return (
    <Box style={collapseStyles([badge2Styles.badge, style])}>
      <Text style={collapseStyles([badge2Styles.text, numberStyle])} type="HeaderBig">
        {number}
      </Text>
    </Box>
  )
}

const badge2Styles = styleSheetCreate({
  badge: {
    ...globalStyles.flexBoxCenter,
    backgroundColor: globalColors.orange,
    borderRadius: 14,
    flex: 0,
    paddingBottom: 2,
    paddingLeft: 6,
    paddingRight: 6,
    paddingTop: 4,
  },
  text: {
    color: globalColors.white,
    flex: 0,
    fontSize: 11,
    lineHeight: 12,
  },
})
