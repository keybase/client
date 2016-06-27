import React, {Component} from 'react'
import {View, Text} from 'react-native'

export default class HeaderRender extends Component {
  render () {
    return (
      <View style={{flexDirection: 'row'}}>
        <Text>You accessed /private/cecile</Text>
      </View>
    )
  }
}
