// @flow
import * as React from 'react'
import {Box, Text} from '.'
import * as Styles from '../styles'

export type BadgeProps = {
  badgeNumber: ?number,
  badgeStyle?: any,
  badgeNumberStyle?: Object,
  largerBadgeMinWidthFix?: boolean,
}

export type Badge2Props = {
  badgeNumber: number,
  fontSize: number,
  height?: number,
  leftRightPadding: number,
  badgeStyle?: Styles.StylesCrossPlatform,
  badgeNumberStyle?: Styles.StylesCrossPlatform,
}

export type DefaultBadge2Props = {
  fontSize: number,
  leftRightPadding: number,
}

export function Badge({badgeStyle, badgeNumber, badgeNumberStyle, largerBadgeMinWidthFix}: BadgeProps) {
  return (
    <Box
      style={Styles.collapseStyles([
        badgeStyles.badge,
        largerBadgeMinWidthFix && badgeStyles.largerBadgeMinWidthFix,
        badgeStyle,
      ])}
    >
      <Text style={Styles.collapseStyles([badgeStyles.text, badgeNumberStyle])} type="HeaderBig">
        {badgeNumber}
      </Text>
    </Box>
  )
}

const badgeStyles = Styles.styleSheetCreate({
  badge: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxRow,
      alignItems: 'center',
      backgroundColor: Styles.globalColors.orange,
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
  text: Styles.platformStyles({
    common: {
      color: Styles.globalColors.white,
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
  static defaultProps = {fontSize: 12, leftRightPadding: 6}

  render() {
    // Default to a top and bottom padding of 4px (8px total)
    // Padding less this can result in badges being wider than their height for single digit numbers
    const height = this.props.height || this.props.fontSize + 8

    return (
      <Box
        style={Styles.collapseStyles([
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
          style={Styles.collapseStyles([
            badge2Styles.text,
            this.props.badgeNumberStyle,
            {fontSize: this.props.fontSize},
          ])}
        >
          {this.props.badgeNumber}
        </Text>
      </Box>
    )
  }
}

const badge2Styles = Styles.styleSheetCreate({
  badge: {
    ...Styles.globalStyles.flexBoxColumn,
    ...Styles.globalStyles.flexBoxCenter,
    backgroundColor: Styles.globalColors.orange,
  },
  text: {
    color: Styles.globalColors.white,
    textAlign: 'center',
    lineHeight: 0,
  },
})
