// @flow
import * as signupActions from '../../actions/signup'
import React, {Component} from 'react'
import Render from './request-invite-success.render'
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'

class RequestInviteSuccess extends Component<any> {
  render() {
    return <Render onBack={this.props.restartSignup} />
  }
}

export default connect(state => ({}), dispatch => bindActionCreators(signupActions, dispatch))(
  RequestInviteSuccess
)
