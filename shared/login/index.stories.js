// @flow
import * as React from 'react'
import {type Props, default as Login} from './login'
import {action, storiesOf} from '../stories/storybook'

const commonProps: Props = {
  users: ['awendland'],
  passphrase: '',
  onForgotPassphrase: action('onForgotPassphrase'),
  onSignup: action('onSignup'),
  onBack: action('onBack'),
  onSomeoneElse: action('onSomeoneElse'),
  error: null,
  waitingForResponse: false,
  showTyping: false,
  saveInKeychain: false,
  selectedUser: null,
  selectedUserChange: action('selectedUserChange'),
  passphraseChange: action('passphraseChange'),
  showTypingChange: action('showTypingChange'),
  saveInKeychainChange: action('saveInKeychainChange'),
  onSubmit: action('onSubmit'),
  onLogin: action('onLogin'),
  onFeedback: action('onFeedback'),
}

const load = () => {
  storiesOf('Login', module).add('Login', () => <Login {...commonProps} />)
}

export default load
