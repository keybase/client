/* @flow */

import React, {Component} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'

import Render from './username-email-form.render'
import * as signupActions from '../../actions/signup'
import type {Props} from './username-email-form.render'

type State = {
  username: string,
  email: string
}

class UsernameEmailForm extends Component {
  state: State;

  constructor (props: Props) {
    super(props)

    this.state = {
      username: this.props.username || '',
      email: this.props.email || '',
    }
  }

  render () {
    return (
      <Render
        usernameChange={username => this.setState({username})}
        username={this.state.username}
        emailChange={email => this.setState({email})}
        email={this.state.email}
        onSubmit={() => this.props.checkUsernameEmail(this.state.username, this.state.email)}
        usernameErrorText={this.props.usernameErrorText}
        emailErrorText={this.props.emailErrorText}
        onBack={this.props.resetSignup}
        waiting={this.props.waiting} />
    )
  }
}

export default connect(
  state => ({
    usernameErrorText: state.signup.usernameError,
    emailErrorText: state.signup.emailError,
    username: state.signup.username,
    email: state.signup.email,
    waiting: state.signup.waiting,
  }),
  dispatch => bindActionCreators(signupActions, dispatch)
)(UsernameEmailForm)
