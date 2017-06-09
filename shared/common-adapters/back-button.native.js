// @flow

import React, {Component} from 'react'
import {NativeTouchableWithoutFeedback} from './native-wrappers.native'
import Badge from './badge'
import Box from './box'
import Icon from './icon'
import {globalStyles} from '../styles'
import type {Props} from './back-button'
import {clickableVisible} from '../local-debug'

export default class BackButton extends Component {
  props: Props

  onClick(event: SyntheticEvent) {
    event && event.preventDefault && event.preventDefault()
    event && event.stopPropagation && event.stopPropagation()
    if (this.props.onClick) {
      this.props.onClick()
    }
  }

  render() {
    return (
      <NativeTouchableWithoutFeedback onPress={e => this.onClick(e)}>
        <Box style={{...styles.container, ...(clickableVisible ? visibleStyle : {}), ...this.props.style}}>
          <Icon type="iconfont-back" style={{...styles.icon, ...this.props.iconStyle}} />
          {(this.props.badgeNumber || 0) > 0 &&
            <Badge badgeNumber={this.props.badgeNumber} badgeStyle={{marginLeft: -3, marginTop: -12}} />}
        </Box>
      </NativeTouchableWithoutFeedback>
    )
  }
}

const visibleStyle = {
  backgroundColor: 'rgba(0, 255, 0, 0.1)',
}

export const styles = {
  container: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center',
    marginRight: 8,
  },
  icon: {
    fontSize: 24,
  },
}
