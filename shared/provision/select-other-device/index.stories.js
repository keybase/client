// @flow
import * as React from 'react'
import SelectOtherDevice from '.'
import {action, storiesOf} from '../../stories/storybook'
import * as Constants from '../../constants/provision'

const rd = {
  cTime: 0,
  encryptKey: '',
  lastUsedTime: 0,
  mTime: 0,
  status: 0,
  verifyKey: '',
}

const props = {
  devices: [
    Constants.rpcDeviceToDevice({...rd, deviceID: '1', name: 'iphone', type: 'mobile'}),
    Constants.rpcDeviceToDevice({
      ...rd,
      deviceID: '2',
      name: 'Home Computer',
      type: 'desktop',
    }),
    Constants.rpcDeviceToDevice({
      ...rd,
      deviceID: '3',
      name: 'Android Nexus 5x',
      type: 'mobile',
    }),
    Constants.rpcDeviceToDevice({
      ...rd,
      deviceID: '4',
      name: 'Tuba Contest',
      type: 'backup',
    }),
  ],
  onBack: action('onBack'),
  onResetAccount: action('onResetAccount'),
  onSelect: action('onSelect'),
  waiting: false,
}

const load = () => {
  storiesOf('Provision/SelectOtherDevice', module).add('Normal', () => <SelectOtherDevice {...props} />)
}

export default load
