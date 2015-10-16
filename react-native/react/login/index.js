'use strict'
/* @flow */

import React, { Component, Text, StyleSheet, View } from 'react-native'
import DevicePrompt from './device-prompt'
import SelectSigner from './select-signer'
import DisplaySecretWords from './display-secret-words'
import LoginForm from './form'

export default class LoginContainer extends Component {
  render () {
    return (
      <View style={styles.container}>
        <Text>Welp, you shouldn't be here</Text>
      </View>
    )
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        title: 'Keybase',
        saveKey: 'Login',
        leftButtonTitle: '¯\\_(ツ)_/¯',
        mapStateToProps: state => state.login,
        props: {
          onLoggedIn: () => {
            this.showSearch()
          }
        }
      },
      subRoutes: {
        loginform: LoginForm,
        'device-prompt': DevicePrompt,
        'device-signer': SelectSigner,
        'show-secret-words': DisplaySecretWords
      }
    }
  }
}

LoginContainer.propTypes = {
  onLoggedIn: React.PropTypes.func.isRequired,
  dispatch: React.PropTypes.func.isRequired,
  loginState: React.PropTypes.string.isRequired,
  username: React.PropTypes.string,
  passphrase: React.PropTypes.string,
  storeSecret: React.PropTypes.bool.isRequired,
  deviceName: React.PropTypes.string,
  waitingForServer: React.PropTypes.bool.isRequired,
  response: React.PropTypes.object,
  signers: React.PropTypes.object,
  secretWords: React.PropTypes.string,
  error: React.PropTypes.string
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5FCFF'
  }
})
