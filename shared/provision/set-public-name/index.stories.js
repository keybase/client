// @flow
import * as React from 'react'
import * as PropProviders from '../../stories/prop-providers'
import SetPublicName from '.'
import {action, storiesOf} from '../../stories/storybook'

const props = {
  deviceName: '',
  error: '',
  onBack: action('onBack'),
  onChange: action('onChange'),
  onSubmit: action('onSubmit'),
}

const load = () => {
  storiesOf('Provision/SetPublicName', module)
    .addDecorator(PropProviders.CommonProvider())
    .add('Normal', () => <SetPublicName {...props} />)
    .add('Error', () => <SetPublicName {...props} error={'Name taken'} />)
}

export default load
