// @flow
import * as React from 'react'
import * as PropProviders from '../../../stories/prop-providers'
import Passphrase from '.'
import {action, storiesOf} from '../../../stories/storybook'
import HiddenString from '../../../util/hidden-string'

const props = {
  checkPassphrase: action('checkPassphrase'),
  onBack: action('onBack'),
  onSubmit: action('onSubmit'),
  pass1: '',
  pass1Update: action('pass1Update'),
  pass2: '',
  pass2Update: action('pass2Update'),
  passphraseError: null,
}

const provider = PropProviders.Common()

const load = () => {
  storiesOf('Signup/Passphrase', module)
    .addDecorator(provider)
    .add('Start', () => <Passphrase {...props} />)
    .add('Error', () => <Passphrase {...props} passphraseError={new HiddenString('This is an error')} />)
}

export default load
