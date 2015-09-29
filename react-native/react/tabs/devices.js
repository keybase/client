'use strict'
/* @flow */

import React from 'react-native'
const {
  Component,
  Text,
  View
} = React

export default class Devices extends Component {
  render () {
    return (
      <View style={{flex: 1, justifyContent: 'center'}}>
        <Text> Devices goes here </Text>
        <Text> No Touching! </Text>
      </View>
    )
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {component: Devices},
      parseNextRoute: null
    }
  }
}
