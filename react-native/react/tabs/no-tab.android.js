'use strict'
/* @flow */

import React, { Component, Text, View } from 'react-native'

export default class NoTab extends Component {
  render () {
    return (
      <View style={{flex: 1, justifyContent: 'center', backgroundColor: 'red'}}>
        <Text> Error! Tab name was not recognized</Text>
      </View>
    )
  }

  static parseRoute (store, currentPath, nextPath) {
    const componentAtTop = {
      component: NoTab
    }

    return {
      componentAtTop,
      parseNextRoute: null
    }
  }
}
