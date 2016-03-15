/* @flow */

import React, {Component} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'

import Render from './request-invite.render.desktop'
import * as signupActions from '../../actions/signup'

class RequestInvite extends Component {
  render () {
    return (
      <Render
        name={this.props.name}
        email={this.props.email}
        error={this.props.error}
        onBack={this.props.resetSignup}
        onRequestInvite={this.props.requestInvite}
      />
    )
  }
}

export default connect(
  state => ({error: state.signup.requestInviteError}),
  dispatch => bindActionCreators(signupActions, dispatch)
)(RequestInvite)
