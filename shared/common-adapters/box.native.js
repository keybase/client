import React, {Component} from 'react'
import {View} from 'react-native'

export default class Box extends Component {
  render () {
    return (
      <View {...this.props}/>
    )
  }
}
