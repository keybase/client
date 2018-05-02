// @flow
import * as React from 'react'
import Login, {type Props} from '.'
import {action, storiesOf} from '../../stories/storybook'

const commonProps: Props = {
  error: '',
  onBack: action('onBack'),
  onFeedback: action('onFeedback'),
  onForgotPassphrase: action('onForgotPassphrase'),
  onLogin: action('onLogin'),
  onSignup: action('onSignup'),
  onSomeoneElse: action('onSomeoneElse'),
  onSubmit: action('onSubmit'),
  passphrase: '',
  passphraseChange: action('passphraseChange'),
  saveInKeychain: false,
  saveInKeychainChange: action('saveInKeychainChange'),
  selectedUser: null,
  selectedUserChange: action('selectedUserChange'),
  showTyping: false,
  showTypingChange: action('showTypingChange'),
  users: ['awendland'],
  waitingForResponse: false,
}

const load = () => {
  storiesOf('Login/Login', module)
    .add('Single previous user', () => <Login {...commonProps} />)
    .add('Error', () => <Login {...commonProps} error="Oh, no! What a mess!" />)
    .add('Multiple previous users', () => (
      <Login {...commonProps} users={['awendland', 'mgood', 'marcopolo']} />
    ))
}

export default load
