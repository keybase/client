/* @flow */

import React, {Component} from 'react'
import {connect} from 'react-redux'
import HiddenString from '../../../util/hidden-string'
import {restartSignup} from '../../../actions/signup'

import Render from './index.render'

class SignupError extends Component {
  render () {
    return (
      <Render
        errorText={this.props.errorText}
        restartSignup={this.props.restartSignup} />
    )
  }
}

SignupError.propTypes = {
  errorText: React.PropTypes.instanceOf(HiddenString).isRequired,
  restartSignup: React.PropTypes.func.isRequired,
}

export default connect(
  state => ({errorText: state.signup.signupError}),
  dispatch => ({restartSignup: () => dispatch(restartSignup())})
)(SignupError)
