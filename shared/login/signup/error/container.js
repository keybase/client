// @flow
import React, {Component} from 'react'
import Render from '.'
import {connect, type TypedState, type Dispatch} from '../../../util/container'
import {restartSignup} from '../../../actions/signup'

class SignupError extends Component<any> {
  render() {
    return <Render errorText={this.props.errorText} restartSignup={this.props.restartSignup} />
  }
}

const mapStateToProps = (state: TypedState) => ({errorText: state.signup.signupError})
const mapDispatchToProps = (dispatch: Dispatch) => ({restartSignup: () => dispatch(restartSignup())})

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(SignupError)
