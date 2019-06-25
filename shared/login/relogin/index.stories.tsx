import * as React from 'react'
import * as Sb from '../../stories/storybook'
import Login, {Props} from '.'

const commonProps: Props = {
  bannerError: false,
  error: '',
  inputError: false,
  inputKey: '0',
  onFeedback: Sb.action('onFeedback'),
  onForgotPassword: Sb.action('onForgotPassword'),
  onLogin: Sb.action('onLogin'),
  onSignup: Sb.action('onSignup'),
  onSomeoneElse: Sb.action('onSomeoneElse'),
  onSubmit: Sb.action('onSubmit'),
  password: '',
  passwordChange: Sb.action('passwordChange'),
  selectedUser: 'awendland',
  selectedUserChange: Sb.action('selectedUserChange'),
  showTyping: false,
  showTypingChange: Sb.action('showTypingChange'),
  users: ['awendland'],
}

const load = () => {
  Sb.storiesOf('Login/Login', module)
    .add('Single previous user', () => <Login {...commonProps} />)
    .add('Input Error', () => <Login {...commonProps} inputError={true} error="Oh, no! What a mess!" />)
    .add('Banner Error', () => <Login {...commonProps} bannerError={true} error="Oh, no! What a mess!" />)
    .add('3 previous users', () => <Login {...commonProps} users={['awendland', 'mgood', 'marcopolo']} />)
    .add('5 previous users', () => (
      <Login {...commonProps} users={['awendland', 'mgood', 'marcopolo', 'trex', 'chrisnojima']} />
    ))
}

export default load
