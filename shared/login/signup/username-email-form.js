/* @flow */

import React, {Component} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'

import Render from './username-email-form.render'
import * as signupActions from '../../actions/signup'

class UsernameEmailForm extends Component {
  render () {
    return (
      <Render
        username={this.props.username}
        email={this.props.email}
        submitUserEmail={this.props.checkUsernameEmail}
        usernameErrorText={this.props.usernameErrorText}
        emailErrorText={this.props.emailErrorText}
        onBack={this.props.resetSignup}/>
    )
  }
}

UsernameEmailForm.propTypes = {
  checkUsernameEmail: React.PropTypes.func,
  usernameErrorText: React.PropTypes.string,
  emailErrorText: React.PropTypes.string,
  username: React.PropTypes.string,
  email: React.PropTypes.string
}

export default connect(
  state => ({
    usernameErrorText: state.signup.usernameError,
    emailErrorText: state.signup.emailError,
    username: state.signup.username,
    email: state.signup.email
  }),
  dispatch => bindActionCreators(signupActions, dispatch)
)(UsernameEmailForm)
