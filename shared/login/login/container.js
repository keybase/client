// @flow
import * as LoginGen from '../../actions/login-gen'
import HiddenString from '../../util/hidden-string'
import Login from '.'
import {compose, withState, withHandlers, connect, type TypedState} from '../../util/container'
import {requestAutoInvite} from '../../actions/signup'

const mapStateToProps = (state: TypedState) => {
  const users = (state.login.configuredAccounts && state.login.configuredAccounts.map(c => c.username)) || []
  let lastUser = state.config.extendedConfig && state.config.extendedConfig.defaultUsername

  if (users.indexOf(lastUser) === -1 && users.length) {
    lastUser = users[0]
  }

  return {
    error: state.login.loginError,
    lastUser,
    serverURI: 'https://keybase.io',
    users,
    waitingForResponse: state.login.waitingForResponse,
  }
}

const mapDispatchToProps = (dispatch: any, {navigateAppend}) => ({
  onForgotPassphrase: () => dispatch(LoginGen.createOpenAccountResetPage()),
  onLogin: (user: string, passphrase: string) =>
    dispatch(LoginGen.createRelogin({usernameOrEmail: user, passphrase: new HiddenString(passphrase)})),
  onSignup: () => dispatch(requestAutoInvite()),
  onSomeoneElse: () => {
    dispatch(LoginGen.createStartLogin())
  },
  onFeedback: () => dispatch(navigateAppend(['feedback'])),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  withState('selectedUser', 'setSelectedUser', props => props.lastUser),
  withState('showTyping', 'showTypingChange', false),
  withState('passphrase', 'passphraseChange', ''),
  withHandlers({
    onSubmit: props => () => {
      if (props.selectedUser) {
        props.onLogin(props.selectedUser, props.passphrase)
      }
    },
    selectedUserChange: props => user => props.setSelectedUser(user),
  })
)(Login)
