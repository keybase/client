/* @flow */

import React, {Component} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'

import Render from './request-invite.render.desktop'
import * as signupActions from '../../actions/signup'

class RequestInvite extends Component {
  render () {
    console.error(this.props.emailErrorText)
    return (
      <Render
        name={this.props.name}
        email={this.props.email}
        emailErrorText={this.props.emailErrorText}
        nameErrorText={this.props.nameErrorText}
        onBack={this.props.resetSignup}
        onRequestInvite={this.props.requestInvite}
      />
    )
  }
}

export default connect(
  state => ({
    emailErrorText: state.signup.emailError,
    nameErrorText: state.signup.nameError
  }),
  dispatch => bindActionCreators(signupActions, dispatch)
)(RequestInvite)
