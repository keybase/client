/* @flow */

import React, {Component} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'

import Render from './request-invite.render'
import * as signupActions from '../../actions/signup'
import type {Props} from './request-invite.render'

class RequestInvite extends Component {
  state: {
    email: string,
    name: string
  };

  constructor (props: Props) {
    super(props)

    this.state = {
      email: this.props.email || '',
      name: this.props.name || '',
    }
  }

  render () {
    return (
      <Render
        name={this.state.name}
        nameChange={name => this.setState({name})}
        email={this.state.email}
        emailChange={email => this.setState({email})}
        emailErrorText={this.props.emailErrorText}
        nameErrorText={this.props.nameErrorText}
        onBack={this.props.resetSignup}
        onSubmit={() => this.props.requestInvite(this.state.email, this.state.name)}
        waiting={this.props.waiting} />
    )
  }
}

export default connect(
  state => ({
    emailErrorText: state.signup.emailError,
    nameErrorText: state.signup.nameError,
    waiting: state.signup.waiting,
  }),
  dispatch => bindActionCreators(signupActions, dispatch)
)(RequestInvite)
