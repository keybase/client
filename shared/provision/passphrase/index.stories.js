// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import Passphrase from '.'

const props = {
  error: null,
  onBack: Sb.action('onBack'),
  onChange: Sb.action('onChange'),
  onForgotPassphrase: Sb.action('onForgotPassphrase'),
  onSubmit: Sb.action('onSubmit'),
  passphrase: null,
  prompt: 'Type in passphrase',
  saveInKeychain: false,
  showTyping: false,
  toggleSaveInKeychain: Sb.action('toggleSaveInKeychain'),
  toggleShowTyping: Sb.action('toggleShowTyping'),
  username: 'ciphersaurus_rex',
  waitingForResponse: false,
}

const load = () => {
  Sb.storiesOf('Provision/Passphrase', module)
    .add('None', () => <Passphrase {...props} />)
    .add('Error', () => <Passphrase {...props} error={'error here!'} />)
    .add('Show typing', () => <Passphrase {...props} showTyping={true} passphrase={'hunter2'} />)
    .add('Show typing error', () => (
      <Passphrase {...props} showTyping={true} passphrase={'hunter2'} error={'too weak'} />
    ))
}

export default load
