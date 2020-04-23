import * as React from 'react'
import {Box, Box2} from './box'
import Text from './text'
import * as Styles from '../styles'

export type Badge2Props = {
  badgeNumber?: number
  className?: string
  fontSize: number
  height: number
  leftRightPadding: number
  containerStyle?: Styles.StylesCrossPlatform
  badgeStyle?: Styles.StylesCrossPlatform
  badgeNumberStyle?: Styles.StylesCrossPlatform
  border?: boolean
}

export default class Badge extends React.Component<Badge2Props> {
  static defaultProps = {
    fontSize: Styles.isMobile ? 12 : 10,
    height: Styles.isMobile ? 20 : 16,
    leftRightPadding: Styles.isPhone ? 5 : 4,
  }

  render() {
    return this.props.border ? this.renderWithBorder() : this.renderNoBorder()
  }

  renderWithBorder() {
    const outerSize = this.props.height
    const innerSize = this.props.border ? this.props.height - 3 : this.props.height
    return (
      <Box2
        direction="vertical"
        centerChildren={true}
        style={Styles.collapseStyles([
          styles.container,
          {
            borderRadius: outerSize,
            height: outerSize,
            minWidth: outerSize,
          },
          this.props.containerStyle,
        ])}
      >
        <Box
          className={this.props.className}
          style={Styles.collapseStyles([
            styles.badge,
            {
              borderRadius: innerSize,
              height: innerSize,
              minWidth: innerSize,
              paddingLeft: this.props.leftRightPadding,
              paddingRight: this.props.leftRightPadding,
            },
            this.props.badgeStyle,
          ])}
        >
          {!!this.props.badgeNumber && (
            <Text
              center={true}
              type="BodyTinyBold"
              style={Styles.collapseStyles([
                styles.text,
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
          )}
        </Box>
      </Box2>
    )
  }

  renderNoBorder() {
    return (
      <Box
        className={this.props.className}
        style={Styles.collapseStyles([
          styles.badge,
          {
            borderRadius: this.props.height,
            height: this.props.height,
            minWidth: this.props.height,
            paddingLeft: this.props.leftRightPadding,
            paddingRight: this.props.leftRightPadding,
          },
          this.props.badgeStyle,
        ])}
      >
        {!!this.props.badgeNumber && (
          <Text
            center={true}
            type="BodyTinyBold"
            style={Styles.collapseStyles([
              styles.text,
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
        )}
      </Box>
    )
  }
}

const styles = Styles.styleSheetCreate(() => ({
  badge: {
    ...Styles.globalStyles.flexBoxRow,
    ...Styles.globalStyles.flexBoxCenter,
    backgroundColor: Styles.globalColors.orange,
  },
  container: {
    backgroundColor: Styles.globalColors.white,
  },
  text: {
    color: Styles.globalColors.white,
  },
}))
