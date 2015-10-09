'use strict'
/* @flow */

import React, { Component, StyleSheet, Text, TextInput, View } from 'react-native'
import commonStyles from '../../../styles/common'
import Button from '../../../common-adapters/button'

export default class PaperKey extends Component {
  render () {
    return (
      <View style={[styles.container, {paddingTop: 200}]}>
        <Text style={commonStyles.h1}>Register with a paper key</Text>
        <Text style={commonStyles.h2}>Lorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem ipsum Lorem ipsum </Text>
        <TextInput
          placeholder='Enter your paper key'
        />
        <Button onPress={() => { console.log('TODO') }} title='Submit'/>
      </View>
    )
  }

  static parseRoute (store, currentPath, nextPath) {
    const routes = { }

    const componentAtTop = {
      title: '',
      component: PaperKey,
      leftButtonTitle: '',
      mapStateToProps: state => state.login2
    }

    // Default the next route to the login form
    const parseNextRoute = routes[nextPath.get('path')]

    return {
      componentAtTop,
      parseNextRoute
    }
  }

}

PaperKey.propTypes = {
  dispatch: React.PropTypes.func.isRequired
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  }
})

