'use strict'
/* @flow */

import React from 'react-native'
import {
  Component,
  StyleSheet,
  Text,
  View
} from 'react-native'

import { navigateTo } from '../../actions/router'

import ForgotUserPass from './forgotUserPass'

export default class Welcome extends Component {
  render () {
    return (
      <View style={styles.container}>
        <Text>Welcome</Text>
        <Text onPress={() => {
          console.log('TODO Show User/Pass area on this screen')
        }}>Login</Text>
        <Text onPress={() => {
          this.props.dispatch(navigateTo(['login2', 'welcome', 'forgotUserPass']))
        }}>Forgot password</Text>
        <Text onPress={() => {
          console.log('TODO Show signup flow')
        }}>Signup</Text>
        <Text onPress={() => {
          console.log('TODO Ask user to enter the problem')
        }}>Report a bug or problem</Text>
      </View>
    )
  }

  static parseRoute (store, currentPath, nextPath) {
    const routes = {
      forgotUserPass: ForgotUserPass.parseRoute
    }

    const componentAtTop = {
      title: '',
      component: Welcome,
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

Welcome.propTypes = {
  dispatch: React.PropTypes.func.isRequired
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  }
})

