'use strict'
/* @flow */

import React from '../base-react'
import BaseComponent from '../base-component'
import { Text, View, StyleSheet } from 'react-native'

export default class ChatRender extends BaseComponent {
  render () {
    return (
      <View style={styles.container}>
        <Text> Error! Tab name was not recognized </Text>
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
  }
})
