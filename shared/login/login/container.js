// @flow
import * as LoginGen from '../../actions/login-gen'
import HiddenString from '../../util/hidden-string'
import Login, {type Props} from '.'
import {
  compose,
  lifecycle,
  withStateHandlers,
  withHandlers,
  connect,
  type TypedState,
} from '../../util/container'
import {requestAutoInvite} from '../../actions/signup'

const mapStateToProps = (state: TypedState) => {
  const _accounts = state.login.configuredAccounts
  const _defaultUsername = state.config.extendedConfig && state.config.extendedConfig.defaultUsername

  return {
    _accounts,
    _defaultUsername,
    error: state.login.loginError,
    waitingForResponse: state.login.waitingForResponse,
  }
}

const mapDispatchToProps = (dispatch: any, {navigateAppend}) => ({
  _resetError: () => dispatch(LoginGen.createLoginError({error: ''})),
  onFeedback: () => dispatch(navigateAppend(['feedback'])),
  onForgotPassphrase: () => dispatch(LoginGen.createOpenAccountResetPage()),
  onLogin: (user: string, passphrase: string) =>
    dispatch(LoginGen.createRelogin({passphrase: new HiddenString(passphrase), usernameOrEmail: user})),
  onSignup: () => dispatch(requestAutoInvite()),
  onSomeoneElse: () => dispatch(LoginGen.createStartLogin()),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const users = stateProps._accounts.map(a => a.username).sort()
  const lastUser = users.contains(stateProps._defaultUsername) ? stateProps._defaultUsername : users.first()

  return {
    ...stateProps,
    ...dispatchProps,
    ...ownProps,
    lastUser,
    serverURI: 'https://keybase.io',
    users: users.toArray(),
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  withStateHandlers(props => ({selectedUser: props.lastUser, showTyping: false, passphrase: ''}), {
    setSelectedUser: () => selectedUser => ({selectedUser}),
    showTypingChange: () => showTyping => ({showTyping}),
    passphraseChange: () => passphrase => ({passphrase}),
  }),
  withHandlers({
    onSubmit: props => () => {
      if (props.selectedUser) {
        props.onLogin(props.selectedUser, props.passphrase)
      }
    },
    selectedUserChange: props => user => props.setSelectedUser(user),
  }),
  lifecycle({
    componentDidUpdate(prevProps: Props) {
      // Clear the passphrase when there's an error.
      // We’re doing this here because passphrase isn’t in the store.
      // Otherwise, we’d use a saga.
      if (this.props.error !== prevProps.error) {
        this.props.passphraseChange()
      }
      // Same here but for clearing the error.
      if (this.props.selectedUser !== prevProps.selectedUser) {
        this.props._resetError()
      }
    },
  })
)(Login)
