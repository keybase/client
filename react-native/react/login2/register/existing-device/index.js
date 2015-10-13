'use strict'
/* @flow */

import React, { Component, StyleSheet, Text, View } from 'react-native'

export default class ExistingDevice extends Component {
  render () {
    return (
      <View style={styles.container}>
        <Text>Existing Device</Text>
        <Text>existing computer?</Text>
        <Text>Existing phone?</Text>
      </View>
    )
  }

  static parseRoute (store, currentPath, nextPath) {
    const routes = { }

    const componentAtTop = {
      title: '',
      component: ExistingDevice,
      leftButtonTitle: '',
      mapStateToProps: state => state.login2
    }

    const parseNextRoute = routes[nextPath.get('path')]

    return {
      componentAtTop,
      parseNextRoute
    }
  }

}

ExistingDevice.propTypes = {
  dispatch: React.PropTypes.func.isRequired
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  }
})

