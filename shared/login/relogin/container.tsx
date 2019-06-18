import * as React from 'react'
import * as LoginGen from '../../actions/login-gen'
import * as ProvisionGen from '../../actions/provision-gen'
import * as SignupGen from '../../actions/signup-gen'
import HiddenString from '../../util/hidden-string'
import Login from '.'
import {connect, networkErrorCodes} from '../../util/container'

type OwnProps = {
  navigateAppend: (...args: Array<any>) => any
}

const mapStateToProps = state => ({
  _users: state.config.configuredAccounts,
  error: state.login.error,
  selectedUser: state.config.defaultUsername,
})

const mapDispatchToProps = (dispatch, ownProps: OwnProps) => ({
  onFeedback: () => dispatch(ownProps.navigateAppend(['feedback'])),
  onForgotPassword: () => dispatch(LoginGen.createLaunchForgotPasswordWebPage()),
  onLogin: (username: string, password: string) =>
    dispatch(LoginGen.createLogin({password: new HiddenString(password), username})),
  onSignup: () => dispatch(SignupGen.createRequestAutoInvite()),
  onSomeoneElse: () => dispatch(ProvisionGen.createStartProvision()),
})

const mergeProps = (stateProps, dispatchProps) => {
  const users = stateProps._users.sort().toArray()
  const bannerError = !!stateProps.error && networkErrorCodes.includes(stateProps.error.code)
  const inputError = !!stateProps.error && !bannerError

  return {
    bannerError,
    error: stateProps.error ? stateProps.error.desc : '',
    inputError,
    onFeedback: dispatchProps.onFeedback,
    onForgotPassword: dispatchProps.onForgotPassword,
    onLogin: dispatchProps.onLogin,
    onSignup: dispatchProps.onSignup,
    onSomeoneElse: dispatchProps.onSomeoneElse,
    selectedUser: stateProps.selectedUser,
    users,
  }
}

type State = {
  password: string
  showTyping: boolean
  selectedUser: string
  inputKey: number
}

type Props = {
  users: Array<string>
  onForgotPassword: () => void
  onSignup: () => void
  onSomeoneElse: () => void
  bannerError: boolean
  inputError: boolean
  error: string
  selectedUser: string
  onFeedback: () => void
  onLogin: (user: string, password: string) => void
}

class LoginWrapper extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      inputKey: 1,
      password: '',
      selectedUser: props.selectedUser,
      showTyping: false,
    }
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    // Clear the password when there's an input error.
    if (this.props.inputError !== prevProps.inputError) {
      this.setState(p => ({inputKey: p.inputKey + 1, password: ''}))
    }
    if (this.props.selectedUser !== prevProps.selectedUser) {
      this.setState({selectedUser: this.props.selectedUser})
    }
  }

  render() {
    return (
      <Login
        bannerError={this.props.bannerError}
        inputError={this.props.inputError}
        error={this.props.error}
        inputKey={String(this.state.inputKey)}
        onFeedback={this.props.onFeedback}
        onForgotPassword={this.props.onForgotPassword}
        onLogin={this.props.onLogin}
        onSignup={this.props.onSignup}
        onSomeoneElse={this.props.onSomeoneElse}
        onSubmit={() => this.props.onLogin(this.state.selectedUser, this.state.password)}
        password={this.state.password}
        passwordChange={password => this.setState({password})}
        selectedUser={this.state.selectedUser}
        selectedUserChange={selectedUser => this.setState({selectedUser})}
        showTypingChange={showTyping => this.setState({showTyping})}
        showTyping={this.state.showTyping}
        users={this.props.users}
      />
    )
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(LoginWrapper)
