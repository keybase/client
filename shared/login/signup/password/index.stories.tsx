import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import Password from '.'

const props = {
  error: '',
  onBack: Sb.action('onBack'),
  onSubmit: Sb.action('onSubmit'),
  password: '',
}

const load = () => {
  Sb.storiesOf('Signup/Password', module)
    .add('Start', () => <Password {...props} />)
    .add('Error', () => <Password {...props} error="This is an error" />)
}

export default load
