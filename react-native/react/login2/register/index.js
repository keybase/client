'use strict'
/* @flow */

import React, { Component, StyleSheet, Text, View } from 'react-native'
import { routeAppend } from '../../actions/router'
import PaperKey from './paper-key'
import UserPass from './user-pass'
import ExistingDevice from './existing-device'
import SetPublicName from './set-public-name'

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
        mapStateToProps: state => { return {} },
        props: {
          gotoExistingDevicePage: () => store.dispatch(routeAppend('regExistingDevice')),
          gotoPaperKeyPage: () => store.dispatch(routeAppend('regPaperKey')),
          gotoUserPassPage: () => store.dispatch(routeAppend('regUserPass'))
        }
      },
      subRoutes: {
        regPaperKey: PaperKey,
        regUserPass: UserPass,
        regExistingDevice: ExistingDevice,
        regSetPublicName: SetPublicName
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

