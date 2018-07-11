// @flow
import Box from './box'
import * as React from 'react'
import Text from './text'
import {globalStyles, globalColors, styleSheetCreate, collapseStyles, platformStyles} from '../styles'

import type {BadgeProps, Badge2Props} from './badge'

export function Badge({badgeStyle, badgeNumber, badgeNumberStyle, largerBadgeMinWidthFix}: BadgeProps) {
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
  badge: platformStyles({
    common: {
      ...globalStyles.flexBoxRow,
      alignItems: 'center',
      backgroundColor: globalColors.orange,
      justifyContent: 'center',
    },
    isElectron: {
      borderRadius: 10,
      height: 16,
      marginLeft: 'auto',
      marginRight: 8,
      minWidth: 16,
      paddingLeft: 4,
      paddingRight: 5,
    },
    isMobile: {
      borderRadius: 14,
      flex: 0,
      paddingBottom: 2,
      paddingLeft: 6,
      paddingRight: 6,
      paddingTop: 4,
    },
  }),
  largerBadgeMinWidthFix: {
    minWidth: 24.5,
    paddingLeft: 4,
    paddingRight: 4,
  },
  text: platformStyles({
    common: {
      color: globalColors.white,
      flex: 0,
    },
    isElectron: {
      lineHeight: 8,
      fontSize: 9,
    },
    isMobile: {
      fontSize: 11,
      lineHeight: 12,
    },
  }),
})

export class Badge2 extends React.Component<Badge2Props> {
  static defaultProps = {fontSize: 11, leftRightPadding: 6}

  render() {
    // Default to a top and bottom padding of 4px (8px total)
    // Padding less this can result in badges being wider than their height for single digit numbers
    const height = this.props.height || this.props.fontSize + 8

    return (
      <Box
        style={collapseStyles([
          badge2Styles.badge,
          {
            borderRadius: height,
            height,
            minWidth: height,
            paddingLeft: this.props.leftRightPadding,
            paddingRight: this.props.leftRightPadding,
          },
          this.props.badgeStyle,
        ])}
      >
        <Text
          type="BodyTinySemibold"
          style={collapseStyles([
            badge2Styles.text,
            this.props.badgeNumberStyle,
            {fontSize: this.props.fontSize, lineHeight: height},
          ])}
        >
          {this.props.badgeNumber}
        </Text>
      </Box>
    )
  }
}

const badge2Styles = styleSheetCreate({
  badge: {
    ...globalStyles.flexBoxColumn,
    ...globalStyles.flexBoxCenter,
    backgroundColor: globalColors.orange,
  },
  text: {
    color: globalColors.white,
    textAlign: 'center',
  },
})
