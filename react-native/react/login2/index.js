/*
 * Login based on kex2. This will replace login/ when we integrate the FE/BE
 */

'use strict'
/* @flow */

import React, {Component} from '../base-react'
import Welcome from './welcome'
import Register from './register'
import Render from './index.render'

export default class Login extends Component {
  constructor (props) {
    super(props)
  }

  render () {
    return (
      <Render />
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
