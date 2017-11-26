// @flow
import {requestInvite, restartSignup} from '../../actions/signup'
import React, {Component} from 'react'
import Render from './request-invite.render'
import {connect, type TypedState} from '../../util/container'

type ContainerProps = {
  restartSignup: () => void,
  requestInvite: (email: string, name: string) => void,
  nameErrorText: ?string,
  emailErrorText: ?string,
  waiting: boolean,
  email?: ?string,
  name?: ?string,
}

type State = {
  email: string,
  name: string,
}

class RequestInvite extends Component<ContainerProps, State> {
  state: State

  constructor(props: ContainerProps) {
    super(props)

    this.state = {
      email: this.props.email || '',
      name: this.props.name || '',
    }
  }

  render() {
    return (
      <Render
        name={this.state.name}
        nameChange={name => this.setState({name})}
        email={this.state.email}
        emailChange={email => this.setState({email})}
        emailErrorText={this.props.emailErrorText}
        nameErrorText={this.props.nameErrorText}
        onBack={this.props.restartSignup}
        onSubmit={() => this.props.requestInvite(this.state.email, this.state.name)}
        waiting={this.props.waiting}
      />
    )
  }
}

const mapStateToProps = (state: TypedState) => ({
  emailErrorText: state.signup.emailError,
  nameErrorText: state.signup.nameError,
  waiting: state.signup.waiting,
})

const mapDispatchToProps = (dispatch: Dispatch<*>) => ({
  requestInvite: (email, name) => dispatch(requestInvite(email, name)),
  restartSignup: () => dispatch(restartSignup()),
})
export default connect(mapStateToProps, mapDispatchToProps)(RequestInvite)
