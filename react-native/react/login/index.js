/* @flow */

import React, {Component} from '../base-react'
import Welcome from './welcome'
import Register from './register'
import Render from './index.render'

export default class Login extends Component {
  render () {
    return (
      // TODO: hook this up
      <Render
        onSignup={() => {}}
        onLogin={() => {}}/>
    )
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      subRoutes: {
        welcome: Welcome,
        register: Register
      }
    }
  }
}

Login.propTypes = {}
