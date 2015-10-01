'use strict'
/* @flow */

import React from 'react-native'

const {
  Component,
  Text,
  View
} = React

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
