/*
 * Login based on kex2. This will replace login/ when we integrate the FE/BE
 */

'use strict'
/* @flow */

import React, { Component, StyleSheet, View } from 'react-native'
import ProgressIndicator from '../common-adapters/progress-indicator'
import Welcome from './welcome'
import Register from './register'

export default class Login extends Component {
  componentDidMount () {
    // TODO emit action to check loading state
  }

  render () {
    return (
      <View style={styles.container}>
        <ProgressIndicator/>
      </View>
    )
  }

  static parseRoute (store, currentPath, nextPath) {
    const routes = {
      welcome: Welcome.parseRoute,
      register: Register.parseRoute
    }

    const componentAtTop = {
      title: '',
      component: Login,
      leftButtonTitle: '',
      mapStateToProps: state => state.login2,
      props: {
        onLoggedIn: () => {
          this.showSearch()
        }
      }
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
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  }
})

