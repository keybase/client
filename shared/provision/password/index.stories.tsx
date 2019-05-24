import * as React from 'react'
import * as Sb from '../../stories/storybook'
import Password from '.'

const props = {
  error: null,
  onBack: Sb.action('onBack'),
  onChange: Sb.action('onChange'),
  onForgotPassword: Sb.action('onForgotPassword'),
  onSubmit: Sb.action('onSubmit'),
  password: null,
  prompt: 'Type in password',
  saveInKeychain: false,
  showTyping: false,
  toggleSaveInKeychain: Sb.action('toggleSaveInKeychain'),
  toggleShowTyping: Sb.action('toggleShowTyping'),
  username: 'ciphersaurus_rex',
  waitingForResponse: false,
}

const load = () => {
  Sb.storiesOf('Provision/Password', module)
    .add('None', () => <Password {...props} />)
    .add('Error', () => <Password {...props} error={'error here!'} />)
    .add('Show typing', () => <Password {...props} showTyping={true} password={'hunter2'} />)
    .add('Show typing error', () => (
      <Password {...props} showTyping={true} password={'hunter2'} error={'too weak'} />
    ))
}

export default load
