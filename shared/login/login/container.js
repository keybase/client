// @flow
import * as Creators from '../../actions/login/creators'
import Login from '.'
import {compose, withState, withHandlers} from 'recompose'
import {connect} from 'react-redux-profiled'
import {requestAutoInvite} from '../../actions/signup'

import type {TypedState} from '../../constants/reducer'

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
  onForgotPassphrase: () => dispatch(Creators.openAccountResetPage()),
  onLogin: (user, passphrase) => dispatch(Creators.relogin(user, passphrase)),
  onSignup: () => dispatch(requestAutoInvite()),
  onSomeoneElse: () => {
    dispatch(Creators.startLogin())
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
