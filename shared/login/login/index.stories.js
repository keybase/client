// @flow
import * as React from 'react'
import Login, {type Props} from '.'
import {action, storiesOf, PropProviders} from '../../stories/storybook'

const commonProps: Props = {
  error: '',
  onFeedback: action('onFeedback'),
  onForgotPassphrase: action('onForgotPassphrase'),
  onLogin: action('onLogin'),
  onSignup: action('onSignup'),
  onSomeoneElse: action('onSomeoneElse'),
  onSubmit: action('onSubmit'),
  passphrase: '',
  passphraseChange: action('passphraseChange'),
  selectedUser: null,
  selectedUserChange: action('selectedUserChange'),
  showTyping: false,
  showTypingChange: action('showTypingChange'),
  users: ['awendland'],
  waitingForResponse: false,
}

const load = () => {
  storiesOf('Login/Login', module)
    .addDecorator(PropProviders.createPropProviderWithCommon())
    .add('Single previous user', () => <Login {...commonProps} />)
    .add('Error', () => <Login {...commonProps} error="Oh, no! What a mess!" />)
    .add('Multiple previous users', () => (
      <Login {...commonProps} users={['awendland', 'mgood', 'marcopolo']} />
    ))
}

export default load
