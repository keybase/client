// @flow
import * as React from 'react'
import SetPublicName from '.'
import {action, storiesOf} from '../../../stories/storybook'

const props = {
  deviceName: 'MobilePhone',
  deviceNameError: null,
  existingDevices: [],
  onBack: action('onBack'),
  onChange: action('onChange'),
  onSubmit: action('onSubmit'),
  submitEnabled: true,
  waiting: false,
}

const load = () => {
  storiesOf('Register/Set Public Name', module)
    .add('', () => <Setn {...props} />)
    .add('NoUserPassLogin', () => <SelectOtherDevice {...props} canSelectNoDevice={false} />)
}

export default load
