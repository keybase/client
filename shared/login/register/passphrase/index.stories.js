// @flow
import * as React from 'react'
import Passphrase from '.'
import {action, storiesOf} from '../../../stories/storybook'

const props = {
  error: null,
  onBack: action('onBack'),
  onChange: action('onChange'),
  onForgotPassphrase: action('onForgotPassphrase'),
  onSubmit: action('onSubmit'),
  passphrase: null,
  prompt: 'Type in passphrase',
  saveInKeychain: false,
  showTyping: false,
  toggleSaveInKeychain: action('toggleSaveInKeychain'),
  toggleShowTyping: action('toggleShowTyping'),
  username: 'ciphersaurus_rex',
  waitingForResponse: false,
}

const load = () => {
  storiesOf('Register/Passphrase', module)
    .add('None', () => <Passphrase {...props} />)
    .add('Error', () => <Passphrase {...props} error={'error here!'} />)
    .add('Show typing', () => <Passphrase {...props} showTyping={true} passphrase={'hunter2'} />)
    .add('Show typing error', () => (
      <Passphrase {...props} showTyping={true} passphrase={'hunter2'} error={'too weak'} />
    ))
}

export default load
