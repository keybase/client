import React, {Component} from 'react'
import {connect} from 'react-redux'
import {openAccountResetPage} from '../../actions/login'
import {relogin, login, saveInKeychainChanged} from '../../actions/login'
import {routeAppend} from '../../actions/router'
import Render from './index.render'
import type {Props} from './index.render'

type State = {
  selectedUser: ?string,
  saveInKeychain: boolean,
  showTyping: boolean,
  passphrase: string
}

class Login extends Component {
  state: State;

  constructor (props: Props) {
    super(props)

    this.state = {
      selectedUser: props.lastUser,
      saveInKeychain: true,
      showTyping: false,
      passphrase: '',
    }
  }

  _onSubmit () {
    if (this.state.selectedUser) {
      this.props.onLogin(this.state.selectedUser, this.state.passphrase, this.state.saveInKeychain)
    }
  }

  _onSaveInKeychainChange (saveInKeychain) {
    this.props.onSaveInKeychainChange(this.state.selectedUser, saveInKeychain)
    this.setState({saveInKeychain})
  }

  render () {
    return <Render { ...this.props }
      onSubmit={() => this._onSubmit()}
      passphrase={this.state.passphrase}
      showTyping={this.state.showTyping}
      saveInKeychain={this.state.saveInKeychain}
      selectedUser={this.state.selectedUser}
      passphraseChange={passphrase => this.setState({passphrase})}
      showTypingChange={showTyping => this.setState({showTyping})}
      saveInKeychainChange={saveInKeychain => this._onSaveInKeychainChange(saveInKeychain)}
      selectedUserChange={selectedUser => this.setState({selectedUser})}
    />
  }

  static parseRoute (store, currentPath, nextPath) {
    return {componentAtTop: {}}
  }
}

Login.propTypes = Render.propTypes

export default connect(
  store => {
    const users = store.login.configuredAccounts && store.login.configuredAccounts.map(c => c.username) || []
    let lastUser = store.config.username

    if (users.indexOf(lastUser) === -1 && users.length) {
      lastUser = users[0]
    }

    return {
      serverURI: 'https://keybase.io',
      users, lastUser,
      error: store.login.loginError,
      waitingForResponse: store.login.waitingForResponse,
    }
  },
  dispatch => {
    return {
      onForgotPassphrase: () => dispatch(openAccountResetPage()),
      onLogin: (user, passphrase, store) => dispatch(relogin(user, passphrase, store)),
      onSignup: () => dispatch(routeAppend(['signup'])),
      onSomeoneElse: () => { dispatch(login()) },
      onSaveInKeychainChange: (user, saveInKeychain) => { dispatch(saveInKeychainChanged(user, saveInKeychain)) },
    }
  }
)(Login)
