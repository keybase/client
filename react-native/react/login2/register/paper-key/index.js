'use strict'
/* @flow */

import React, { Component, StyleSheet, Text, TextInput, View } from 'react-native'
import commonStyles from '../../../styles/common'
import Button from '../../../common-adapters/button'
import { navigateTo } from '../../../actions/router'

export default class PaperKey extends Component {
  constructor (props) {
    super(props)

    this.state = {
      paperKey: ''
    }
  }

  render () {
    return (
      <View style={[styles.container, {backgroundColor: 'red', paddingTop: 200}]}>
        <Text style={[commonStyles.h1, {padding: 10}]}>Register with a paper key</Text>
        <Text style={[commonStyles.h2, {padding: 10, marginBottom: 20}]}>Lorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem ipsum Lorem ipsum </Text>
        <TextInput style={commonStyles.textInput}
          placeholder='Enter your paper key'
          onChangeText={(paperKey) => this.setState({paperKey})}
        />
        <Button
          style={{alignSelf: 'flex-end', marginRight: 10}}
          onPress={() => { this.props.dispatch(navigateTo(['login2', 'register', 'setPublicName'])) }}
          title='Submit & Log in'
          enabled={this.state.paperKey}/>
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
    alignItems: 'flex-start'
  }
})

