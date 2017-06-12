// @flow
import React, {Component} from 'react'
import Login from '.'
import {connect} from 'react-redux'
import * as Creators from '../../actions/login/creators'
import {requestAutoInvite} from '../../actions/signup'

import type {TypedState} from '../../constants/reducer'
import type {Props} from '.'

type State = {
  selectedUser: ?string,
  showTyping: boolean,
  passphrase: string,
}

// TODO remove this class
class _Login extends Component {
  state: State

  constructor(props: Props & {lastUser: ?string}) {
    super(props)

    this.state = {
      selectedUser: props.lastUser,
      showTyping: false,
      passphrase: '',
    }
  }

  _onSubmit() {
    if (this.state.selectedUser) {
      this.props.onLogin(this.state.selectedUser, this.state.passphrase)
    }
  }

  render() {
    return (
      <Login
        {...this.props}
        onSubmit={() => this._onSubmit()}
        passphrase={this.state.passphrase}
        showTyping={this.state.showTyping}
        selectedUser={this.state.selectedUser}
        passphraseChange={passphrase => this.setState({passphrase})}
        showTypingChange={showTyping => this.setState({showTyping})}
        selectedUserChange={selectedUser => this.setState({selectedUser})}
      />
    )
  }
}

const mapStateToProps = (state: TypedState) => {
  const users = (state.login.configuredAccounts && state.login.configuredAccounts.map(c => c.username)) || []
  let lastUser = state.config.extendedConfig && state.config.extendedConfig.defaultUsername

  if (users.indexOf(lastUser) === -1 && users.length) {
    lastUser = users[0]
  }

  return {
    serverURI: 'https://keybase.io',
    users,
    lastUser,
    error: state.login.loginError,
    waitingForResponse: state.login.waitingForResponse,
  }
}

const mapDispatchToProps = (dispatch: any) => ({
  onForgotPassphrase: () => dispatch(Creators.openAccountResetPage()),
  onLogin: (user, passphrase) => dispatch(Creators.relogin(user, passphrase)),
  onSignup: () => dispatch(requestAutoInvite()),
  onSomeoneElse: () => {
    dispatch(Creators.startLogin())
  },
})

export default connect(mapStateToProps, mapDispatchToProps)(_Login)
