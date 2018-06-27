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

const load = () => {
  storiesOf('Signup/Passphrase', module)
    .addDecorator(PropProviders.Common())
    .add('Start', () => <Passphrase {...props} />)
    .add('Error', () => <Passphrase {...props} error="This is an error" />)
}

export default load
