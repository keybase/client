'use strict'

import React, {Component} from '../../base-react'
import {connect} from '../../base-redux'
import Login from './login'
import Signup from './signup'
import {routeAppend} from '../../actions/router'
import {login} from '../../actions/login2'
import Render from './index.render'

class Welcome extends Component {
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
      componentAtTop: {hideNavBar: true},
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

export default connect(
  null,
  dispatch => {
    return {
      gotoLoginPage: () => dispatch(login()),
      gotoSignupPage: () => dispatch(routeAppend('signup'))
    }
  }
)(Welcome)
