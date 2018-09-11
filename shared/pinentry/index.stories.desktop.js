// @flow
import * as React from 'react'
import Pinentry from './index.desktop'
import {action, storiesOf} from '../stories/storybook'
import {passphraseCommonPassphraseType} from '../constants/types/rpc-gen'

const props = {
  onCancel: action('onCancel'),
  onSubmit: action('onSubmit'),
  prompt: 'Enter your passphrase to unlock the secret key for home computer.',
  retryLabel: undefined,
  showTyping: {allow: true, defaultValue: false, label: 'Show typing', readonly: false},
  type: passphraseCommonPassphraseType.passPhrase,
}

const paperkeyProps = {
  ...props,
  prompt: 'Enter your paper key to continue.',
  showTyping: {allow: true, defaultValue: true, label: 'Show typing', readonly: false},
  type: passphraseCommonPassphraseType.paperKey,
}

const load = () => {
  storiesOf('Pinentry', module)
    .add('Normal', () => <Pinentry {...props} />)
    .add('Error', () => <Pinentry {...props} retryLabel={'That passphrase is incorrect.'} />)
    .add('Paperkey', () => <Pinentry {...paperkeyProps} />)
    .add('Paperkey Error', () => <Pinentry {...paperkeyProps} retryLabel={'That paperkey is invalid.'} />)
}

export default load
