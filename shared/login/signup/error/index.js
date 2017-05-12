// @flow
import React, {Component} from 'react'
import Render from './index.render'
import {connect} from 'react-redux'
import {restartSignup} from '../../../actions/signup'

class SignupError extends Component {
  render() {
    return (
      <Render
        errorText={this.props.errorText}
        restartSignup={this.props.restartSignup}
      />
    )
  }
}

// $FlowIssue type this connector
export default connect(
  state => ({errorText: state.signup.signupError}),
  dispatch => ({restartSignup: () => dispatch(restartSignup())})
)(SignupError)
