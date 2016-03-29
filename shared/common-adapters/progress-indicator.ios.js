import React, {Component} from 'react'
import {ActivityIndicatorIOS} from 'react-native'
import {globalColors} from '../styles/style-guide'
export default ActivityIndicatorIOS

export default class ProgressIndicator extends Component {
  render () {
    return <ActivityIndicatorIOS
      color={this.props.white ? globalColors.white : globalColors.black}
      style={{...style, ...this.props.style}}/>
  }
}

const style = {
  alignItems: 'center',
  justifyContent: 'center'
}

