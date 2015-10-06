'use strict'

import React, { Component, StyleSheet, Text, View, NativeModules } from 'react-native'
const swiftNative = NativeModules.SwiftTest

export default class SwiftTest extends Component {
  constructor () {
    super()

    this.state = {
      result: ''
    }

    swiftNative.example('This is', (fromSwift) => {
      this.setState({result: fromSwift})
    })
  }

  render () {
    return (
      <View style={styles.container}>
      <Text style={styles.welcome}>{this.state.result}</Text>
      </View>
    )
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5FCFF'
  },
  welcome: {
    fontSize: 20,
    textAlign: 'center',
    margin: 10
  }
})
