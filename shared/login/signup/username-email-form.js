// @flow
import * as Creators from '../../actions/signup'
import React, {Component} from 'react'
import Render, {type Props} from './username-email-form.render'
import {connect, type TypedState} from '../../util/container'

type State = {
  username: string,
  email: string,
}

// Todo: type properly, recompose.withState
class UsernameEmailForm extends Component<any, State> {
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

const mapStateToProps = (state: TypedState) => ({
  usernameErrorText: state.signup.usernameError && state.signup.usernameError.message,
  emailErrorText: state.signup.emailError && state.signup.emailError.message,
  username: state.signup.username,
  email: state.signup.email,
  waiting: state.signup.waiting,
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  checkUsernameEmail: (user: ?string, email: ?string) => dispatch(Creators.checkUsernameEmail(user, email)),
  restartSignup: () => dispatch(Creators.restartSignup()),
})

export default connect(mapStateToProps, mapDispatchToProps)(UsernameEmailForm)
