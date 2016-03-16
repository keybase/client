/* @flow */

import React, {Component} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'

import Render from './request-invite-success.render'
import * as signupActions from '../../actions/signup'

class RequestInviteSuccess extends Component {
  render () {
    return (
      <Render
        onBack={this.props.resetSignup}
      />
    )
  }
}

export default connect(
  state => ({}),
  dispatch => bindActionCreators(signupActions, dispatch)
)(RequestInviteSuccess)
