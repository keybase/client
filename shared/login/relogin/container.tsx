import * as React from 'react'
import * as LoginGen from '../../actions/login-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as ProvisionGen from '../../actions/provision-gen'
import * as SignupGen from '../../actions/signup-gen'
import HiddenString from '../../util/hidden-string'
import Login from '.'
import * as Container from '../../util/container'
import * as ConfigTypes from '../../constants/types/config'

type OwnProps = {}

type State = {
  password: string
  showTyping: boolean
  selectedUser: string
  inputKey: number
}

type Props = {
  bannerError: boolean
  inputError: boolean
  error: string
  loggedInMap: Map<string, boolean>
  onFeedback: () => void
  onForgotPassword: () => void
  onLogin: (user: string, password: string) => void
  onSignup: () => void
  onSomeoneElse: () => void
  selectedUser: string
  users: Array<ConfigTypes.ConfiguredAccount>
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

  _selectedUserChange = (selectedUser: string) => {
    this.setState({selectedUser})
    if (this.props.loggedInMap.get(selectedUser)) {
      this.props.onLogin(selectedUser, '')
    }
  }

  componentDidUpdate(prevProps: Props) {
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
        selectedUserChange={this._selectedUserChange}
        showTypingChange={showTyping => this.setState({showTyping})}
        showTyping={this.state.showTyping}
        users={this.props.users}
      />
    )
  }
}

export default Container.connect(
  state => ({
    _users: state.config.configuredAccounts,
    error: state.login.error,
    selectedUser: state.config.defaultUsername,
  }),
  dispatch => ({
    onFeedback: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['feedback']})),
    onForgotPassword: () => dispatch(LoginGen.createLaunchForgotPasswordWebPage()),
    onLogin: (username: string, password: string) =>
      dispatch(LoginGen.createLogin({password: new HiddenString(password), username})),
    onSignup: () => dispatch(SignupGen.createRequestAutoInvite()),
    onSomeoneElse: () => dispatch(ProvisionGen.createStartProvision()),
  }),
  (stateProps, dispatchProps, _: OwnProps) => {
    const users = stateProps._users.sortBy(account => account.username).toArray()
    const bannerError = !!stateProps.error && Container.isNetworkErr(stateProps.error.code)
    const inputError = !!stateProps.error && !bannerError

    return {
      bannerError,
      error: stateProps.error ? stateProps.error.desc : '',
      inputError,
      loggedInMap: new Map<string, boolean>(
        stateProps._users.map(account => [account.username, account.hasStoredSecret])
      ),
      onFeedback: dispatchProps.onFeedback,
      onForgotPassword: dispatchProps.onForgotPassword,
      onLogin: dispatchProps.onLogin,
      onSignup: dispatchProps.onSignup,
      onSomeoneElse: dispatchProps.onSomeoneElse,
      selectedUser: stateProps.selectedUser,
      users,
    }
  }
)(LoginWrapper)
