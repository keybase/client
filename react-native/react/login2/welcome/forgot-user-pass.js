'use strict'
/* @flow */

import React, { Component, StyleSheet, Text, View } from 'react-native'

export default class ForgotUserPass extends Component {
  render () {
    return (
      <View style={styles.container}>
        <Text>Forgot Username?</Text>
        <Text>Enter user name</Text>
        <Text>Submit</Text>
      </View>
    )
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        mapStateToProps: state => state.login2
      }
    }
  }
}

ForgotUserPass.propTypes = {
  dispatch: React.PropTypes.func.isRequired
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  }
})

