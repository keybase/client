/* @flow */

import React, {Component} from 'react'
import {connect} from 'react-redux'
import HiddenString from '../../../util/hidden-string'
import {resetSignup} from '../../../actions/signup'

import Render from './index.render'

class SignupError extends Component {
  render () {
    return (
      <Render
        errorText={this.props.errorText}
        resetSignup={this.props.resetSignup} />
    )
  }
}

SignupError.propTypes = {
  errorText: React.PropTypes.instanceOf(HiddenString).isRequired,
  resetSignup: React.PropTypes.func.isRequired,
}

export default connect(
  state => ({errorText: state.signup.signupError}),
  dispatch => ({resetSignup: () => dispatch(resetSignup())})
)(SignupError)
