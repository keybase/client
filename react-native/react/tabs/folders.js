'use strict'
/* @flow */

import React, { Component, Text, View } from 'react-native'

export default class Folders extends Component {
  render () {
    return (
      <View style={{flex: 1, justifyContent: 'center'}}>
        <Text> Folders go here</Text>
        <Text> Whoa, whoa, whoa, whoa, theres still plenty of meat on that bone. Now you take this home, throw it in a pot, add some broth, a potato. Baby you got a stew going! </Text>
      </View>
    )
  }

  // TODO(mm): annotate types
  // store is our redux store
  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {component: Folders},
      parseNextRoute: null
    }
  }
}
