/* @flow */
import React, {Component} from 'react'
import {ActivityIndicatorIOS} from 'react-native'
import {globalColors} from '../styles/style-guide'
import type {Props} from './progress-indicator'

export default class ProgressIndicator extends Component {
  props: Props;

  render () {
    const size = (this.props.type === 'Large') ? 'large' : 'small'

    return <ActivityIndicatorIOS
      color={this.props.white ? globalColors.white : globalColors.black}
      size={size}
      style={{...style, ...this.props.style}} />
  }
}

const style = {
  alignItems: 'center',
  justifyContent: 'center',
}
