'use strict'
/* @flow */

import React, { Component } from '../../base-react'
import Login from './login'
import Signup from './signup'
import { routeAppend } from '../../actions/router'
import { login } from '../../actions/login2'
import Render from './index.render'

export default class Welcome extends Component {
  render () {
    return (
      <Render
        onGotoLoginPage={() => this.props.dispatch(login())}
        onGotoSignupPage={() => this.props.dispatch(routeAppend('signup'))}
      />
    )
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        hideNavBar: true
      },
      subRoutes: {
        'login': Login,
        'signup': Signup
      }
    }
  }
}

Welcome.propTypes = {
  dispatch: React.PropTypes.func.isRequired
}
