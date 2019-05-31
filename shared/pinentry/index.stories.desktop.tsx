import * as React from 'react'
import Pinentry from './index.desktop'
import {action, storiesOf} from '../stories/storybook'
import {PassphraseType} from '../constants/types/rpc-gen'

const props = {
  onCancel: action('onCancel'),
  onSubmit: action('onSubmit'),
  prompt: 'Enter your password to unlock the secret key for home computer.',
  retryLabel: undefined,
  showTyping: {allow: true, defaultValue: false, label: 'Show typing', readonly: false},
  type: PassphraseType.passPhrase,
}

const paperkeyProps = {
  ...props,
  prompt: 'Enter your paper key to continue.',
  showTyping: {allow: true, defaultValue: true, label: 'Show typing', readonly: false},
  type: PassphraseType.paperKey,
}

const load = () => {
  storiesOf('Pinentry', module)
    .add('Normal', () => <Pinentry {...props} />)
    .add('Error', () => <Pinentry {...props} retryLabel={'That password is incorrect.'} />)
    .add('Paperkey', () => <Pinentry {...paperkeyProps} />)
    .add('Paperkey Error', () => <Pinentry {...paperkeyProps} retryLabel={'That paperkey is invalid.'} />)
}

export default load
