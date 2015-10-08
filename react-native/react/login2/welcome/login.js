'use strict'
/* @flow */

import React, { Component, Text, TextInput, View } from 'react-native'
import commonStyles from '../../styles/common'
import { welcomeSubmitUserPass } from '../../actions/login2'
import { routeAppend } from '../../actions/router'
import ForgotUserPass from './forgot-user-pass'

export default class Login extends Component {
  constructor (props) {
    super(props)

    this.state = {
      username: this.props.username || '',
      passphrase: this.props.passphrase || ''
    }
  }

  submitLogin () {
    this.props.dispatch(welcomeSubmitUserPass(this.state.username, this.state.passphrase))
  }

  render () {
    return (
      <View style={{ flex: 1, marginTop: 64, marginBottom: 48, justifyContent: 'flex-start' }}>
        <Text style={commonStyles.h1}>Log in -</Text>
        <Text style={[commonStyles.h2, {marginBottom: 40}]}>Already a keybase user? Welcome back!</Text>
        <TextInput
          style={commonStyles.textInput}
          onChangeText={(username) => this.setState({username})}
          value={this.state.username}
          autoCorrect={false}
          placeholder='Username'
          returnKeyType='next'
          clearButtonMode='while-editing'
        />
        <TextInput
          style={commonStyles.textInput}
          onChangeText={(passphrase) => this.setState({passphrase})}
          onSubmitEditing={() => this.submitLogin()}
          value={this.state.passphrase}
          autoCorrect={false}
          placeholder='Passphrase'
          returnKeyType='go'
          clearButtonMode='while-editing'
          secureTextEntry
        />
        <View style={{alignItems: 'flex-end', justifyContent: 'flex-end', padding: 10}}>
          <Text style={{marginTop: 20, padding: 10}} onPress={() => { this.props.dispatch(routeAppend('forgotUserPass')) }}>Forgot username/passphrase?</Text>
        </View>
        <View style={{alignItems: 'flex-end', justifyContent: 'flex-end', padding: 10}}>
          <Text style={{marginTop: 20, padding: 10}} onPress={() => { this.submitLogin() }}>Submit</Text>
        </View>
      </View>
    )
  }

  static parseRoute (store, currentPath, nextPath) {
    const routes = {
      forgotUserPass: ForgotUserPass.parseRoute
    }

    const componentAtTop = {
      title: '',
      component: Login,
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

Login.propTypes = {
  dispatch: React.PropTypes.func.isRequired,
  username: React.PropTypes.string,
  passphrase: React.PropTypes.string
}
