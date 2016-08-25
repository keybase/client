// @flow
import React, {Component} from 'react'
import type {Props} from './progress-indicator'
import {ActivityIndicator} from 'react-native'
import {globalColors} from '../styles'

class ProgressIndicator extends Component<void, Props, void> {
  render () {
    const size = (this.props.type === 'Large') ? 'large' : 'small'

    return <ActivityIndicator
      color={this.props.white ? globalColors.white : globalColors.black}
      size={size}
      style={{...style, ...this.props.style}} />
  }
}

const style = {
  alignItems: 'center',
  justifyContent: 'center',
}

export default ProgressIndicator
