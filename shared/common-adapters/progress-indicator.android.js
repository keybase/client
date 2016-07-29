// @flow
import React, {Component} from 'react'
import type {Props} from './progress-indicator'
import {ProgressBarAndroid} from 'react-native'
import {globalColors} from '../styles/style-guide'

class ProgressIndicator extends Component<void, Props, void> {
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

export default ProgressIndicator
