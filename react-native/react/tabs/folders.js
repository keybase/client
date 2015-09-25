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

module.exports = Folders
