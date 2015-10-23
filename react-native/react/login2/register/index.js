'use strict'
/* @flow */

import React, { Component, StyleSheet, Text, View } from 'react-native'
import { routeAppend } from '../../actions/router'
import PaperKey from './paper-key'
import UserPass from './user-pass'
import ExistingDevice from './existing-device'
import SetPublicName from './set-public-name'
import { bindActionCreators } from 'redux'

export default class Register extends Component {
  render () {
    return (
      <View style={styles.container}>
        <Text>Register</Text>
        <Text onPress={() => { this.props.routeAppend('regExistingDevice') }}>Use an existing device</Text>
        <Text onPress={() => { this.props.routeAppend('regPaperKey') }}>Use a paper key</Text>
        <Text onPress={() => { this.props.routeAppend('regUserPass') }}>Use my keybase passphrase</Text>
      </View>
    )
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        mapStateToProps: state => { return {} },
        props: {
          routeAppend: bindActionCreators(routeAppend, store.dispatch)
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
  routeAppend: React.PropTypes.func.isRequired
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  }
})

