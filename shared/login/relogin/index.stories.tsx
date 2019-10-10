import * as React from 'react'
import * as Sb from '../../stories/storybook'
import Login, {Props} from '.'

const makeAccount = (username: string) => ({
  hasStoredSecret: username !== 'no_secret',
  username,
})

const commonProps: Props = {
  error: '',
  needPassword: true,
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
  users: ['awendland'].map(makeAccount),
}

const load = () => {
  Sb.storiesOf('Login/Login', module)
    .add('Single previous user', () => <Login {...commonProps} />)
    .add('Input Error', () => <Login {...commonProps} error="Oh, no! What a mess!" />)
    .add('Banner Error', () => <Login {...commonProps} error="Oh, no! What a mess!" />)
    .add('3 previous users', () => (
      <Login {...commonProps} users={['awendland', 'mgood', 'no_secret'].map(makeAccount)} />
    ))
    .add('5 previous users', () => (
      <Login
        {...commonProps}
        users={['awendland', 'no_secret', 'marcopolo', 'trex', 'chrisnojima'].map(makeAccount)}
      />
    ))
}

export default load
