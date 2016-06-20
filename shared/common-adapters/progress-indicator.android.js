/* @flow */
import React, {Component} from 'react'
import {ProgressBarAndroid} from 'react-native'
import {globalColors} from '../styles/style-guide'
import type {Props} from './progress-indicator'

export default class ProgressIndicator extends Component {
  props: Props;

  render () {
    const styleAttr = (this.props.type === 'Large') ? 'Normal' : 'Small'

    return <ProgressBarAndroid
      color={this.props.white ? globalColors.white : globalColors.black}
      styleAttr={styleAttr}
      style={{...style, ...this.props.style}} />
  }
}

const style = {
  alignItems: 'center',
  justifyContent: 'center',
}
