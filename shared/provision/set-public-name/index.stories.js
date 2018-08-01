// @flow
import * as React from 'react'
import SetPublicName from '.'
import {action, storiesOf, PropProviders} from '../../stories/storybook'

const props = {
  deviceName: '',
  error: '',
  onBack: action('onBack'),
  onChange: action('onChange'),
  onSubmit: action('onSubmit'),
}

const load = () => {
  storiesOf('Provision/SetPublicName', module)
    .addDecorator(PropProviders.createPropProviderWithCommon())
    .add('Normal', () => <SetPublicName {...props} />)
    .add('Error', () => <SetPublicName {...props} error={'Name taken'} />)
}

export default load
