// @flow
import * as React from 'react'
import SelectOtherDevice from '.'
import {action, storiesOf} from '../../../stories/storybook'

const mockDevices = [['iphone', 'mobile'], ['Home Computer', 'desktop'], ['Android Nexus 5x', 'mobile']].map(
  ([name, type], i) => ({deviceID: i.toString(), name, type})
)

const props = {
  canSelectNoDevice: true,
  devices: mockDevices,
  onBack: action('onBack'),
  onReset: action('onReset'),
  onSelect: action('onSelect'),
  onWont: action('onWont'),
}

const load = () => {
  storiesOf('Register/SelectOtherDevice', module)
    .add('Normal', () => <SelectOtherDevice {...props} />)
    .add('NoUserPassLogin', () => <SelectOtherDevice {...props} canSelectNoDevice={false} />)
}

export default load
