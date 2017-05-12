// @flow

import React, {Component} from 'react'
import {NativeTouchableWithoutFeedback} from './native-wrappers.native'
import Box from './box'
import Icon from './icon'
import {globalStyles} from '../styles'
import type {Props} from './back-button'

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
        <Box style={{...styles.container, ...this.props.style}}>
          <Icon
            type="iconfont-back"
            style={{...styles.icon, ...this.props.iconStyle}}
          />
        </Box>
      </NativeTouchableWithoutFeedback>
    )
  }
}

BackButton.propTypes = {
  onClick: React.PropTypes.func.isRequired,
  style: React.PropTypes.object,
}

export const styles = {
  container: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center',
  },
  icon: {
    fontSize: 24,
    marginRight: 8,
  },
}
