'use strict'
/* @flow */

const React = require('react-native')

const {
  Component,
  Text,
  View
} = React

class Folders extends Component {

  render () {
    return (
      <View style={{backgroundColor: 'red'}}>
        <Text> Folders is alive </Text>
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

module.exports = Folders
