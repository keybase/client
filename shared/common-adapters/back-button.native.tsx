import React, {Component} from 'react'
import {NativeTouchableWithoutFeedback} from './native-wrappers.native'
import Badge from './badge'
import Box from './box'
import Icon, {castPlatformStyles as iconCastPlatformStyles} from './icon'
import * as Styles from '../styles'
import {Props} from './back-button'

export default class BackButton extends Component<Props> {
  onClick(event: React.BaseSyntheticEvent) {
    event && event.preventDefault && event.preventDefault()
    event && event.stopPropagation && event.stopPropagation()
    if (this.props.onClick) {
      this.props.onClick()
    }
  }

  render() {
    return (
      <NativeTouchableWithoutFeedback onPress={e => this.onClick(e)}>
        <Box style={Styles.collapseStyles([styles.container, this.props.style])}>
          <Icon
            type="iconfont-arrow-left"
            fontSize={iconFontSize}
            color={this.props.iconColor}
            style={iconCastPlatformStyles(styles.arrow)}
          />
          {!!this.props.badgeNumber && <Badge badgeNumber={this.props.badgeNumber} />}
        </Box>
      </NativeTouchableWithoutFeedback>
    )
  }
}

const styles = Styles.styleSheetCreate({
  arrow: {marginRight: -3, marginTop: 2},
  container: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    marginRight: 8,
    padding: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.small - 4,
    paddingRight: Styles.globalMargins.small,
  },
})

const iconFontSize = 24
