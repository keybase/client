// @flow
import React, {Component} from 'react'
import Render from './index.render'
import {connect} from 'react-redux'
import {restartSignup} from '../../../actions/signup'
import HiddenString from '../../../util/hidden-string'

import type {TypedState} from '../../../constants/reducer'
import type {TypedDispatch} from '../../../constants/types/flux'

class SignupError extends Component {
  render () {
    return (
      <Render
        errorText={this.props.errorText}
        restartSignup={this.props.restartSignup} />
    )
  }
}

export default connect(
  (state: TypedState) => ({errorText: state.signup.signupError || new HiddenString('')}),
  (dispatch: TypedDispatch<*>) => ({restartSignup: () => dispatch(restartSignup())})
)(SignupError)
