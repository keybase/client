'use strict'
/* @flow */

import React from 'react-native'

const {
  Component,
  Text,
  StyleSheet,
  View
} = React

import DevicePrompt from './device-prompt'
import SelectSigner from './select-signer'
import DisplaySecretWords from './display-secret-words'
import LoginForm from './form'

import engine from '../engine'

import { bindActionCreators } from 'redux'
import * as LoginActions from '../actions/login'

class LoginContainer extends Component {
  constructor (props) {
    super(props)

    const { dispatch } = this.props
    this.actions = bindActionCreators(LoginActions, dispatch)
    // TODO move this into the router logic
    this.showingLoginState = null
  }

  componentWillUnmount () {
    // TEMP just to help debugging
    engine.reset()
    // stop login if not all the way through?
  }

  render () {
    return (
      <View style={styles.container}>
        <Text>Welp, you shouldn't be here</Text>
      </View>
    )
  }

  static parseRoute (store, route) {
    // TODO(mm): maybe these route names can be the constants we are already using?
    // e.g. state.SHOW_SECRET_WORDS
    const routes = {
      'loginform': LoginForm.parseRoute,
      'device-prompt': DevicePrompt.parseRoute,
      'device-signer': SelectSigner.parseRoute,
      'show-secret-words': DisplaySecretWords.parseRoute
    }

    const [top, ...rest] = route

    // TODO(mm): figure out how this interacts with redux
    const componentAtTop = {
      title: 'Keybase',
      component: LoginContainer,
      saveKey: 'Login',
      leftButtonTitle: '¯\\_(ツ)_/¯',
      mapStateToProps: state => state.login,
      props: {
        onLoggedIn: () => {
          this.showSearch()
        }
      }
    }

    // Default the next route to the login form
    const parseNextRoute = routes[top] || LoginForm.parseRoute

    return {
      componentAtTop,
      parseNextRoute,
      restRoutes: rest
    }
  }

}

LoginContainer.propTypes = {
  // kbNavigator: React.PropTypes.object.isRequired,
  onLoggedIn: React.PropTypes.func.isRequired,
  dispatch: React.PropTypes.func.isRequired,
  loginState: React.PropTypes.string.isRequired,
  loggedIn: React.PropTypes.bool.isRequired,
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

export default LoginContainer
