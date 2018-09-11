// @flow
import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import Passphrase from '.'

const props = {
  error: '',
  onBack: Sb.action('onBack'),
  onSubmit: Sb.action('onSubmit'),
  passphrase: '',
}

const load = () => {
  Sb.storiesOf('Signup/Passphrase', module)
    .add('Start', () => <Passphrase {...props} />)
    .add('Error', () => <Passphrase {...props} error="This is an error" />)
}

export default load
