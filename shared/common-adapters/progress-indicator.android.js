import React, {Component} from 'react'
import {ProgressBarAndroid} from 'react-native'
import {globalColors} from '../styles/style-guide'

export default class ProgressIndicator extends Component {
  render () {
    return <ProgressBarAndroid
      color={this.props.white ? globalColors.white : globalColors.black}
      styleAttr={this.props.styleAttr || 'Small'}
      style={{...style, ...this.props.style}}/>
  }
}

const style = {
  alignItems: 'center',
  justifyContent: 'center'
}
