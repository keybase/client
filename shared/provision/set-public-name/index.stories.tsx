import * as React from 'react'
import * as Sb from '../../stories/storybook'
import SetPublicName from '.'

const props = {
  deviceIconNumber: 1,
  deviceName: '',
  error: '',
  onBack: Sb.action('onBack'),
  onChange: Sb.action('onChange'),
  onSubmit: Sb.action('onSubmit'),
  waiting: false,
}

const load = () => {
  Sb.storiesOf('Provision/SetPublicName', module)
    .add('Normal', () => <SetPublicName {...props} />)
    .add('Error', () => <SetPublicName {...props} error="Name taken" />)
}

export default load
