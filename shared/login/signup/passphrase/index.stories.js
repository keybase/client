// @flow
import * as React from 'react'
import Passphrase from '.'
import {action, storiesOf, PropProviders} from '../../../stories/storybook'

const props = {
  error: '',
  onBack: action('onBack'),
  onSubmit: action('onSubmit'),
  passphrase: '',
}

const load = () => {
  storiesOf('Signup/Passphrase', module)
    .addDecorator(PropProviders.createPropProviderWithCommon())
    .add('Start', () => <Passphrase {...props} />)
    .add('Error', () => <Passphrase {...props} error="This is an error" />)
}

export default load
