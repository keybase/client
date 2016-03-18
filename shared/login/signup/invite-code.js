/* @flow */

import React, {Component} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'

import Render from './invite-code.render'
import * as signupActions from '../../actions/signup'
import {navigateUp} from '../../actions/router'

class InviteCode extends Component {
  render () {
    return (
      <Render
        inviteCode={this.props.inviteCode}
        onRequestInvite={this.props.startRequestInvite}
        onInviteCodeSubmit={this.props.checkInviteCode}
        inviteCodeErrorText={this.props.errorText}
        onBack={this.props.navigateUp}/>
    )
  }
}

InviteCode.propTypes = {
  checkInviteCode: React.PropTypes.func,
  errorText: React.PropTypes.string
}

export default connect(
  state => ({errorText: state.signup.inviteCodeError, inviteCode: state.signup.inviteCode}),
    dispatch => bindActionCreators({
      ...signupActions,
      navigateUp
    }, dispatch)
)(InviteCode)
