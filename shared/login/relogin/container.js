// @flow
import * as React from 'react'
import * as LoginGen from '../../actions/login-gen'
import * as ProvisionGen from '../../actions/provision-gen'
import * as SignupGen from '../../actions/signup-gen'
import HiddenString from '../../util/hidden-string'
import Login from '.'
import {connect} from '../../util/container'

type OwnProps = {|
  navigateAppend: (...Array<any>) => any,
|}

const mapStateToProps = state => ({
  _users: state.config.configuredAccounts,
  error: state.login.error.stringValue(),
  selectedUser: state.config.defaultUsername,
})

const mapDispatchToProps = (dispatch, ownProps: OwnProps) => ({
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
  inputKey: number,
}

type Props = {
  users: Array<string>,
  onForgotPassphrase: () => void,
  onSignup: () => void,
  onSomeoneElse: () => void,
  error: string,
  selectedUser: string,
  onFeedback: () => void,
  onLogin: (user: string, passphrase: string) => void,
}

class LoginWrapper extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      inputKey: 1,
      passphrase: '',
      selectedUser: props.selectedUser,
      showTyping: false,
    }
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    // Clear the passphrase when there's an error.
    if (this.props.error !== prevProps.error) {
      this.setState(p => ({inputKey: p.inputKey + 1, passphrase: ''}))
    }
    if (this.props.selectedUser !== prevProps.selectedUser) {
      this.setState({selectedUser: this.props.selectedUser})
    }
  }

  render() {
    return (
      <Login
        error={this.props.error}
        inputKey={String(this.state.inputKey)}
        onFeedback={this.props.onFeedback}
        onForgotPassphrase={this.props.onForgotPassphrase}
        onLogin={this.props.onLogin}
        onSignup={this.props.onSignup}
        onSomeoneElse={this.props.onSomeoneElse}
        onSubmit={() => this.props.onLogin(this.state.selectedUser, this.state.passphrase)}
        passphrase={this.state.passphrase}
        passphraseChange={passphrase => this.setState({passphrase})}
        selectedUser={this.state.selectedUser}
        selectedUserChange={selectedUser => this.setState({selectedUser})}
        showTypingChange={showTyping => this.setState({showTyping})}
        showTyping={this.state.showTyping}
        users={this.props.users}
      />
    )
  }
}

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(LoginWrapper)
