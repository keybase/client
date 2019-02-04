// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import Login, {type Props} from '.'

const commonProps: Props = {
  error: '',
  inputKey: '0',
  onFeedback: Sb.action('onFeedback'),
  onForgotPassphrase: Sb.action('onForgotPassphrase'),
  onLogin: Sb.action('onLogin'),
  onSignup: Sb.action('onSignup'),
  onSomeoneElse: Sb.action('onSomeoneElse'),
  onSubmit: Sb.action('onSubmit'),
  passphrase: '',
  passphraseChange: Sb.action('passphraseChange'),
  selectedUser: 'awendland',
  selectedUserChange: Sb.action('selectedUserChange'),
  showTyping: false,
  showTypingChange: Sb.action('showTypingChange'),
  users: ['awendland'],
}

const load = () => {
  Sb.storiesOf('Login/Login', module)
    .add('Single previous user', () => <Login {...commonProps} />)
    .add('Error', () => <Login {...commonProps} error="Oh, no! What a mess!" />)
    .add('3 previous users', () => <Login {...commonProps} users={['awendland', 'mgood', 'marcopolo']} />)
    .add('5 previous users', () => (
      <Login {...commonProps} users={['awendland', 'mgood', 'marcopolo', 'trex', 'chrisnojima']} />
    ))
}

export default load
