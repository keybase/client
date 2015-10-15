'use strict'
/* @flow */

import React, { Component, StyleSheet, Text, View } from 'react-native'

export default class UserPass extends Component {
  render () {
    return (
      <View style={styles.container}>
        <Text>UserPass</Text>
        <Text>User</Text>
        <Text>Pass</Text>
        <Text>Submit</Text>
        <Text>Forgot?</Text>
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

UserPass.propTypes = {
  dispatch: React.PropTypes.func.isRequired
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  }
})

