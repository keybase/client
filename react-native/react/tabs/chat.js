'use strict'
/* @flow */

import React from 'react-native'
const {
  Component,
  Text,
  View
} = React

export default class Chat extends Component {
  render () {
    return (
      <View style={{flex: 1, justifyContent: 'center'}}>
        <Text> Chat goes here </Text>
        <Text> Always Money in the Banana Stand </Text>
      </View>
    )
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {component: Chat},
      parseNextRoute: null
    }
  }
}
