// @flow
// $FlowIssue
import Login from './login'
import React, {Component} from 'react'
// $FlowIssue
import Render from './index.render'
// $FlowIssue
import Signup from './signup'
import {connect} from 'react-redux'
import {login} from '../../actions/login'
import {routeAppend} from '../../actions/router'

class Welcome extends Component {
  render () {
    return (
      <Render
        onGotoLoginPage={this.props.onGotoLoginPage}
        onGotoSignupPage={this.props.onGotoSignupPage}
      />
    )
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {hideNavBar: true},
      subRoutes: {
        'login': Login,
        'signup': Signup,
      },
    }
  }
}

export default connect(
  null,
  dispatch => {
    return {
      onGotoLoginPage: () => dispatch(login()),
      onGotoSignupPage: () => dispatch(routeAppend('signup')),
    }
  }
)(Welcome)
