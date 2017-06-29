// @flow
import * as signupActions from '../../actions/signup'
import React, {Component} from 'react'
import Render from './username-email-form.render'
import type {Props} from './username-email-form.render'
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'

type State = {
  username: string,
  email: string,
}

// Todo: type properly
class UsernameEmailForm extends Component<void, any, State> {
  state: State

  constructor(props: Props) {
    super(props)

    this.state = {
      username: this.props.username || '',
      email: this.props.email || '',
    }
  }

  render() {
    return (
      <Render
        usernameChange={username => this.setState({username})}
        username={this.state.username}
        emailChange={email => this.setState({email})}
        email={this.state.email}
        onSubmit={() => this.props.checkUsernameEmail(this.state.username, this.state.email)}
        usernameErrorText={this.props.usernameErrorText}
        emailErrorText={this.props.emailErrorText}
        onBack={this.props.restartSignup}
        waiting={this.props.waiting}
      />
    )
  }
}

// $FlowIssue type this connector
export default connect(
  state => ({
    usernameErrorText: state.signup.usernameError && state.signup.usernameError.message,
    emailErrorText: state.signup.emailError && state.signup.emailError.message,
    username: state.signup.username,
    email: state.signup.email,
    waiting: state.signup.waiting,
  }),
  dispatch => bindActionCreators(signupActions, dispatch)
)(UsernameEmailForm)
