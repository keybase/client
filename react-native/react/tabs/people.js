'use strict'
/* @flow */

import React from 'react-native'
const {
  Component,
  Text,
  View
} = React

export default class People extends Component {
  render () {
    return (
      <View style={{flex: 1, justifyContent: 'center'}}>
        <Text> People goes here </Text>
        <Text> I mean, it’s one banana, Michael. What could it cost? Ten dollars? </Text>
      </View>
    )
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {component: People},
      parseNextRoute: null
    }
  }
}
