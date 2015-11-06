'use strict'
/* @flow */

import React, { Component, StyleSheet, Text, View } from 'react-native'
import { registerWithUserPass, registerWithPaperKey, registerWithExistingDevice } from '../../actions/login2'

export default class Register extends Component {
  render () {
    return (
      <View style={styles.container}>
        <Text>Register</Text>
        <Text onPress={() => { this.props.gotoExistingDevicePage() }}>Use an existing device</Text>
        <Text onPress={() => { this.props.gotoPaperKeyPage() }}>Use a paper key</Text>
        <Text onPress={() => { this.props.gotoUserPassPage() }}>Use my keybase passphrase</Text>
      </View>
    )
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        props: {
          gotoExistingDevicePage: () => store.dispatch(registerWithExistingDevice()),
          gotoPaperKeyPage: () => store.dispatch(registerWithPaperKey()),
          gotoUserPassPage: () => store.dispatch(registerWithUserPass())
        }
      }
    }
  }
}

Register.propTypes = {
  gotoExistingDevicePage: React.PropTypes.func.isRequired,
  gotoPaperKeyPage: React.PropTypes.func.isRequired,
  gotoUserPassPage: React.PropTypes.func.isRequired
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  }
})

