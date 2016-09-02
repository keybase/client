// @flow
import React, {Component} from 'react'
import Render from './index.render'
import type {Props} from './index.render'
import {connect} from 'react-redux'
import {openAccountResetPage, relogin, login} from '../../actions/login'
import {routeAppend} from '../../actions/router'

type State = {
  selectedUser: ?string,
  showTyping: boolean,
  passphrase: string
}

class Login extends Component {
  state: State;

  constructor (props: Props & {lastUser: ?string}) {
    super(props)

    this.state = {
      selectedUser: props.lastUser,
      showTyping: false,
      passphrase: '',
    }
  }

  _onSubmit () {
    if (this.state.selectedUser) {
      this.props.onLogin(this.state.selectedUser, this.state.passphrase)
    }
  }

  render () {
    return <Render {...this.props}
      onSubmit={() => this._onSubmit()}
      passphrase={this.state.passphrase}
      showTyping={this.state.showTyping}
      selectedUser={this.state.selectedUser}
      passphraseChange={passphrase => this.setState({passphrase})}
      showTypingChange={showTyping => this.setState({showTyping})}
      selectedUserChange={selectedUser => this.setState({selectedUser})}
    />
  }

  static parseRoute (store, currentPath, nextPath) {
    return {componentAtTop: {}}
  }
}

export default connect(
  store => {
    const users = store.login.configuredAccounts && store.login.configuredAccounts.map(c => c.username) || []
    let lastUser = store.config.username

    if (users.indexOf(lastUser) === -1 && users.length) {
      lastUser = users[0]
    }

    return {
      serverURI: 'https://keybase.io',
      users,
      lastUser,
      error: store.login.loginError,
      waitingForResponse: store.login.waitingForResponse,
    }
  },
  dispatch => ({
    onForgotPassphrase: () => dispatch(openAccountResetPage()),
    onLogin: (user, passphrase) => dispatch(relogin(user, passphrase)),
    onSignup: () => dispatch(routeAppend(['signup'])),
    onSomeoneElse: () => { dispatch(login()) },
  })
)(Login)
