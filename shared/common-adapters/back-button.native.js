// @flow

import React, {Component} from 'react'
import {NativeTouchableWithoutFeedback} from './native-wrappers.native'
import Badge from './badge'
import Box from './box'
import Icon from './icon'
import {globalStyles, collapseStyles} from '../styles'
import type {Props} from './back-button'

export default class BackButton extends Component<Props> {
  onClick(event: SyntheticEvent<>) {
    event && event.preventDefault && event.preventDefault()
    event && event.stopPropagation && event.stopPropagation()
    if (this.props.onClick) {
      this.props.onClick()
    }
  }

  render() {
    return (
      <NativeTouchableWithoutFeedback onPress={e => this.onClick(e)}>
        <Box style={collapseStyles([styleContainer, this.props.style])}>
          <Icon type="iconfont-arrow-left" fontSize={iconFontSize} color={this.props.iconColor} />
          {(this.props.badgeNumber || 0) > 0 && (
            <Badge badgeNumber={this.props.badgeNumber} badgeStyle={{marginLeft: -3, marginTop: -12}} />
          )}
        </Box>
      </NativeTouchableWithoutFeedback>
    )
  }
}

export const styleContainer = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  marginRight: 8,
}

const iconFontSize = 24
