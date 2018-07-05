// @flow
import Box from './box'
import * as React from 'react'
import Text from './text'
import {globalStyles, globalColors, styleSheetCreate, collapseStyles} from '../styles'

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

export class Badge2 extends React.Component<Badge2Props> {
  static defaultProps = {fontSize: 11, height: 24, leftRightPadding: 6, topBottomPadding: 4}

  render() {
    return (
      <Box
        style={collapseStyles([
          badge2Styles.badge,
          {
            borderRadius: this.props.height / 2,
            height: this.props.height,
            minWidth: this.props.height,
            paddingBottom: this.props.topBottomPadding,
            paddingLeft: this.props.leftRightPadding,
            paddingRight: this.props.leftRightPadding,
            paddingTop: this.props.topBottomPadding,
          },
          this.props.badgeStyle,
        ])}
      >
        <Text
          type="BodyTinySemibold"
          style={collapseStyles([
            badge2Styles.text,
            this.props.badgeNumberStyle,
            {fontSize: this.props.fontSize, lineHeight: this.props.fontSize + 5},
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
