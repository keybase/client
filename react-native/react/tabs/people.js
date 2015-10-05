'use strict'
/* @flow */

import React from 'react-native'
const {
  Component,
  Text,
  View
} = React

export default class People extends Component {
  constructor (props) {
    super(props)
    this.state = {count: 0}
  }

  render () {
    return (
      <View style={{flex: 1, justifyContent: 'center'}}>
        <Text> People goes here </Text>
        <Text> Count: {this.state.count} </Text>
        <Text
          onPress={() => this.setState({count: this.state.count + 1})}
          style={{fontSize: 32, marginTop: 20, marginBottom: 20}}>
          I mean, it’s one banana, Michael. What could it cost? Ten dollars?
        </Text>
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
