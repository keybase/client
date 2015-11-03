'use strict'
/* @flow */

import React from '../base-react'
import BaseComponent from '../base-component'
import { Text, View, StyleSheet } from 'react-native'
import commonStyles from '../styles/common'

export default class ChatRender extends BaseComponent {
  constructor (props) {
    super(props)
  }

  render () {
    return (
      <View style={styles.container}>
      <Text style={[{textAlign: 'center', marginBottom: 75}, commonStyles.h1]}>Version 0.1</Text>
      </View>
    )
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
    backgroundColor: '#F5FCFF'
  }
})
