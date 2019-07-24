import * as React from 'react'
import Box from './box'
import Text from './text'
import * as Styles from '../styles'

export type Badge2Props = {
  badgeNumber?: number
  className?: string
  fontSize: number
  height: number
  leftRightPadding: number
  badgeStyle?: Styles.StylesCrossPlatform
  badgeNumberStyle?: Styles.StylesCrossPlatform
}

export default class Badge extends React.Component<Badge2Props> {
  static defaultProps = {
    fontSize: Styles.isMobile ? 12 : 10,
    height: Styles.isMobile ? 20 : 16,
    leftRightPadding: Styles.isMobile ? 3 : 4,
  }

  render() {
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
      </Box>
    )
  }
}

const styles = Styles.styleSheetCreate({
  badge: {
    ...Styles.globalStyles.flexBoxRow,
    ...Styles.globalStyles.flexBoxCenter,
    backgroundColor: Styles.globalColors.orange,
  },
  text: {
    color: Styles.globalColors.white,
  },
})
