'use strict'
/* @flow */

import React, { Component, StyleSheet, Text, View, Platform } from 'react-native'
import { routeAppend } from '../../actions/router'
import PaperKey from './paper-key'
import UserPass from './user-pass'
import ExistingDevice from './existing-device'
import SetPublicName from './set-public-name'
import { setCodePageMyRole } from '../../actions/login2'
import { codePageDeviceRoleNewPhone, codePageDeviceRoleNewComputer } from '../../constants/login2'

export default class Register extends Component {
  constructor (props) {
    super(props)

    const myRole = (Platform.OS === 'ios' || Platform.OS === 'android') ? codePageDeviceRoleNewPhone : codePageDeviceRoleNewComputer
    this.props.dispatch(setCodePageMyRole(myRole))
  }

  render () {
    return (
      <View style={styles.container}>
        <Text>Register</Text>
        <Text onPress={() => { this.props.dispatch(routeAppend('regExistingDevice')) }}>Use an existing device</Text>
        <Text onPress={() => { this.props.dispatch(routeAppend('regPaperKey')) }}>Use a paper key</Text>
        <Text onPress={() => { this.props.dispatch(routeAppend('regUserPass')) }}>Use my keybase passphrase</Text>
      </View>
    )
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        mapStateToProps: state => state.login2
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
  dispatch: React.PropTypes.func.isRequired
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  }
})

