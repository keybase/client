// @flow
import * as React from 'react'
import SetPublicName from '.'
import {action, storiesOf} from '../../stories/storybook'

const props = {
  deviceName: 'MobilePhone',
  error: '',
  onBack: action('onBack'),
  onChange: action('onChange'),
  onSubmit: action('onSubmit'),
}

const load = () => {
  storiesOf('Provision/SetPublicName', module)
    .add('Normal', () => <SetPublicName {...props} />)
    .add('Error', () => <SetPublicName {...props} error={'Name taken'} />)
}

export default load
