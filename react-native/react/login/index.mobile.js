/*
 * Login based on kex2. This will replace login/ when we integrate the FE/BE
 */

'use strict'

import React, {Component, StyleSheet, View} from '../base-react'
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

  static parseRoute () {
    return {
      subRoutes: {
        welcome: Welcome,
        register: Register
      }
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

