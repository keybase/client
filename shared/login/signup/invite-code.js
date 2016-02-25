/* @flow */

import React, {Component} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'

import Render from './invite-code.render'
import * as signupActions from '../../actions/signup'

class InviteCode extends Component {
  render () {
    return (
      <Render onInviteCodeSubmit={this.props.checkInviteCode} inviteCodeErrorText={this.props.errorText}/>
    )
  }
}

InviteCode.propTypes = {
  checkInviteCode: React.PropTypes.func,
  errorText: React.PropTypes.string
}

export default connect(
  state => ({}),
  dispatch => bindActionCreators(signupActions, dispatch)
)(InviteCode)
