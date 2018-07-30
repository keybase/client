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
  height: number,
  leftRightPadding: number,
  badgeStyle?: Styles.StylesCrossPlatform,
  badgeNumberStyle?: Styles.StylesCrossPlatform,
}

export type DefaultBadge2Props = {fontSize: number, height: number, leftRightPadding: number}

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
  static defaultProps = {
    fontSize: Styles.isMobile ? 12 : 10,
    height: Styles.isMobile ? 20 : 16,
    leftRightPadding: Styles.isMobile ? 3 : 4,
  }

  render() {
    return (
      <Box
        style={Styles.collapseStyles([
          badge2Styles.badge,
          {
            borderRadius: '50%',
            height: this.props.height,
            minWidth: this.props.height,
            paddingLeft: this.props.leftRightPadding,
            paddingRight: this.props.leftRightPadding,
          },
          this.props.badgeStyle,
        ])}
      >
        <Text
          type="BodyTinyBold"
          style={Styles.collapseStyles([
            badge2Styles.text,
            {
              fontSize: this.props.fontSize,
              height: this.props.height,
              lineHeight: Styles.isMobile ? this.props.height : `${this.props.height}px`,
            },
            this.props.badgeNumberStyle,
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
    ...Styles.globalStyles.flexBoxRow,
    ...Styles.globalStyles.flexBoxCenter,
    backgroundColor: Styles.globalColors.orange,
  },
  text: {
    color: Styles.globalColors.white,
    textAlign: 'center',
  },
})
