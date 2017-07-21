// @flow
import * as signupActions from '../../actions/signup'
import React, {Component} from 'react'
import Render from './request-invite-success.render'
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux-profiled'

class RequestInviteSuccess extends Component {
  render() {
    return <Render onBack={this.props.restartSignup} />
  }
}

// $FlowIssue type this connector
export default connect(state => ({}), dispatch => bindActionCreators(signupActions, dispatch))(
  RequestInviteSuccess
)
