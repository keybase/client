// @flow
import Box from './box'
import * as React from 'react'
import Text from './text'
// import Text from 'react-native'
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

export class Badge2 extends React.Component<Badge2Props, {}> {
  static defaultProps = {
    fontSize: 8,
    radius: 10,
    leftRightPadding: 3,
    topBottomPadding: 3,
  }

  render() {
    return (
      <Box
        style={collapseStyles([
          badge2Styles.badge,
          {
            borderRadius: this.props.radius,
            height: this.props.radius * 2,
            minWidth: this.props.radius * 2,
            paddingBottom: this.props.topBottomPadding,
            paddingLeft: this.props.leftRightPadding,
            paddingRight: this.props.leftRightPadding,
            paddingTop: this.props.topBottomPadding,
          },
          this.props.style,
        ])}
      >
        <Text
          type="BodyTinySemibold"
          style={collapseStyles([
            badge2Styles.text,
            this.props.numberStyle,
            {fontSize: this.props.fontSize, lineHeight: this.props.fontSize + 5},
          ])}
        >
          {this.props.number}
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
