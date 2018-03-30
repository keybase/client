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
  storiesOf('Login', module)
    .add('Single previous user', () => <Login {...commonProps} />)
    .add('Error', () => <Login {...commonProps} error="Oh, no! What a mess!" />)
    .add('Multiple previous users', () => (
      <Login {...commonProps} users={['awendland', 'mgood', 'marcopolo']} />
    ))
}

export default load
