// @flow
import * as React from 'react'
import * as LoginGen from '../../actions/login-gen'
import * as ProvisionGen from '../../actions/provision-gen'
import * as SignupGen from '../../actions/signup-gen'
import HiddenString from '../../util/hidden-string'
import Login, {type Props} from '.'
import {connect, type TypedState, type Dispatch} from '../../util/container'

type OwnProps = {|
  navigateAppend: (...Array<any>) => any,
|}

const mapStateToProps = (state: TypedState) => ({
  _users: state.config.configuredAccounts,
  error: state.login.error.stringValue(),
  selectedUser: state.config.defaultUsername,
})

const mapDispatchToProps = (dispatch: Dispatch, ownProps: OwnProps) => ({
  onFeedback: () => dispatch(ownProps.navigateAppend(['feedback'])),
  onForgotPassphrase: () => dispatch(LoginGen.createLaunchForgotPasswordWebPage()),
  onLogin: (user: string, passphrase: string) =>
    dispatch(LoginGen.createLogin({passphrase: new HiddenString(passphrase), usernameOrEmail: user})),
  onSignup: () => dispatch(SignupGen.createRequestAutoInvite()),
  onSomeoneElse: () => dispatch(ProvisionGen.createStartProvision()),
})

const mergeProps = (stateProps, dispatchProps) => {
  const users = stateProps._users.sort().toArray()

  return {
    error: stateProps.error,
    onFeedback: dispatchProps.onFeedback,
    onForgotPassphrase: dispatchProps.onForgotPassphrase,
    onLogin: dispatchProps.onLogin,
    onSignup: dispatchProps.onSignup,
    onSomeoneElse: dispatchProps.onSomeoneElse,
    selectedUser: stateProps.selectedUser,
    users,
  }
}

type State = {
  passphrase: string,
  showTyping: boolean,
  selectedUser: string,
}

class LoginWrapper extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      passphrase: '',
      selectedUser: props.selectedUser,
      showTyping: false,
    }
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    // Clear the passphrase when there's an error.
    if (this.props.error !== prevProps.error) {
      this.setState({passphrase: ''})
    }
  }

  render() {
    return (
      <Login
        {...this.props}
        error={this.state.selectedUser === this.props.selectedUser ? this.props.error : ''}
        selectedUser={this.state.selectedUser}
        selectedUserChange={selectedUser => this.setState({selectedUser})}
        showTypingChange={showTyping => this.setState({showTyping})}
        passphraseChange={passphrase => this.setState({passphrase})}
        onSubmit={() => this.props.onLogin(this.state.selectedUser, this.state.passphrase)}
      />
    )
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(LoginWrapper)
