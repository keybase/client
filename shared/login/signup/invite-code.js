/* @flow */

import React, {Component} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'

import Render from './invite-code.render'
import * as signupActions from '../../actions/signup'

class InviteCode extends Component {
  render () {
    return (
      <Render inviteCode={this.props.inviteCode} onInviteCodeSubmit={this.props.checkInviteCode} inviteCodeErrorText={this.props.errorText} onBack={() => {}}/>
    )
  }
}

InviteCode.propTypes = {
  checkInviteCode: React.PropTypes.func,
  errorText: React.PropTypes.string
}

export default connect(
  state => ({errorText: state.signup.inviteCodeError, inviteCode: state.signup.inviteCode}),
  dispatch => bindActionCreators(signupActions, dispatch)
)(InviteCode)
