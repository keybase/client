import * as React from 'react'
import * as Sb from '../../stories/storybook'
import Password from '.'

const props = {
  error: '',
  onBack: Sb.action('onBack'),
  onForgotPassword: Sb.action('onForgotPassword'),
  onSubmit: Sb.action('onSubmit'),
  resetRecoverState: Sb.action('resetRecoverState'),
  username: 'ciphersaurus_rex',
  waiting: false,
}

const load = () => {
  Sb.storiesOf('Provision/Password', module)
    .add('None', () => <Password {...props} />)
    .add('Error', () => <Password {...props} error="error here!" />)
}

export default load
