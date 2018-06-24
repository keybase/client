// @flow
import * as React from 'react'
import * as PropProviders from '../../../stories/prop-providers'
import Passphrase from '.'
import {action, storiesOf} from '../../../stories/storybook'

const props = {
  error: '',
  onBack: action('onBack'),
  onSubmit: action('onSubmit'),
  passphrase: '',
}

const provider = PropProviders.Common()

const load = () => {
  storiesOf('Signup/Passphrase', module)
    .addDecorator(provider)
    .add('Start', () => <Passphrase {...props} />)
    .add('Error', () => <Passphrase {...props} error="This is an error" />)
}

export default load
