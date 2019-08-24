import * as React from 'react'
import * as Sb from '../../stories/storybook'
import SetPublicName from '.'

const props = {
  deviceName: '',
  error: '',
  onBack: Sb.action('onBack'),
  onChange: Sb.action('onChange'),
  onSubmit: Sb.action('onSubmit'),
}

const load = () => {
  Sb.storiesOf('Provision/SetPublicName', module)
    .add('Normal', () => <SetPublicName {...props} />)
    .add('Error', () => <SetPublicName {...props} error={'Name taken'} />)
}

export default load
