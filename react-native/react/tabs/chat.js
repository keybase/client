'use strict'
/* @flow */

const React = require('react-native')
const {
  Component,
  Text,
  View
} = React

class Chat extends Component {
  render () {
    return (
      <View>
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

module.exports = Chat
