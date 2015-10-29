'use strict'
/* @flow */

import React from '../base-react'
import BaseComponent from '../base-component'
import { submitDeviceName } from '../actions/login'
import { Component, StyleSheet, View, Text, TextInput } from 'react-native'
import commonStyles from '../styles/common'
import Button from '../common-adapters/button'

export default class DevicePromptRender extends BaseComponent {
  constructor (props) {
    super (props)
  }

  render () {
    return (
      <View style={styles.container}>
        <Text style={[{textAlign: 'center', marginBottom: 75}, commonStyles.h1]}>Set a device name</Text>
        <Text style={[{margin: 20, marginBottom: 20}, commonStyles.h2]}>This is the first time you've logged into this device. You need to register this device by choosing a name. For example, Macbook or Desktop.</Text>
        <TextInput
          style={styles.input}
          placeholder='Device name'
          value={this.state.deviceName}
          enablesReturnKeyAutomatically
          returnKeyType='next'
          autoCorrect={false}
          onChangeText={(deviceName) => this.setState({deviceName})}
          onSubmitEditing={(event) => { this.submit() }}
          />

        {error}

        <View style={styles.submitWrapper}>
          <Button onPress={() => { this.submit() }} title='Next' isSubmit/>
        </View>
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
  },
  input: {
    height: 40,
    marginBottom: 5,
    marginLeft: 10,
    marginRight: 10,
    borderWidth: 0.5,
    borderColor: '#0f0f0f',
    fontSize: 13,
    padding: 4
  },
  submitWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10
  }
})
