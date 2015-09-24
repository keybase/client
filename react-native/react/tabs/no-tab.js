'use strict'
/* @flow */

const React = require('react-native')

const {
  Component,
  Text,
  View
} = React

class NoTab extends Component {

  render () {
    return (
      <View style={{backgroundColor: 'red'}}>
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

module.exports = NoTab
