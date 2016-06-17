import React, {Component} from 'react'
import {connect} from 'react-redux'
import Login from './login'
import Signup from './signup'
import {routeAppend} from '../../actions/router'
import {login} from '../../actions/login'
import Render from './index.render'

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

Welcome.propTypes = {
  onGotoLoginPage: React.PropTypes.func.isRequired,
  onGotoSignupPage: React.PropTypes.func.isRequired,
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
