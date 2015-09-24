'use strict'
/* @flow */

const React = require('react-native')
const {
  Component,
  Text,
  View
} = React

class People extends Component {
  render () {
    return (
      <View>
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

module.exports = People
