// @flow
import * as React from 'react'
import {stringToDeviceID} from '../constants/types/devices'
import {action, storiesOf, createPropProvider} from '../stories/storybook'
import Devices from './container'
import devicePage from './device-page/index.stories'
import deviceRevoke from './device-revoke/index.stories'
import paperKey from './paper-key/index.stories'

const idToType = i => {
  switch (i) {
    case '1':
    case '5':
      return 'desktop'
    case '2':
      return 'mobile'
    default:
      return 'backup'
  }
}

const provider = createPropProvider({
  DeviceRow: ({deviceID}) => ({
    firstItem: deviceID === '1',
    isCurrentDevice: deviceID === '1',
    isRevoked: !['1', '2', '3'].includes(deviceID),
    name: {'1': 'laptop', '2': 'phone', '3': 'hello robot', '4': 'dog party', '5': 'desktop'}[deviceID],
    showExistingDevicePage: action('onShowExistingDevicePage'),
    type: idToType(deviceID),
  }),
  Devices: p => ({
    _stateOverride: p._stateOverride,
    hideMenu: action('hideMenu'),
    items: [
      {id: stringToDeviceID('1'), key: '1', type: 'device'},
      {id: stringToDeviceID('2'), key: '2', type: 'device'},
      {id: stringToDeviceID('3'), key: '3', type: 'device'},
    ],
    loadDevices: action('loaddevices'),
    menuItems: [
      {onClick: action('onAdd phone'), title: 'New phone'},
      {onClick: action('onAdd computer'), title: 'New computer'},
      {onClick: action('onAdd paper key'), title: 'New paper key'},
    ],
    revokedItems: [
      {id: stringToDeviceID('4'), key: '4', type: 'device'},
      {id: stringToDeviceID('5'), key: '5', type: 'device'},
    ],
    showMenu: action('showMenu'),
    showingMenu: false,
    waiting: !!p.waiting,
  }),
})

const load = () => {
  devicePage()
  deviceRevoke()
  paperKey()
  storiesOf('Devices/List', module)
    .addDecorator(provider)
    .add('Current computer', () => <Devices />)
    .add('Revoked expanded', () => <Devices _stateOverride={{revokedExpanded: true}} />)
    .add('Loading', () => <Devices waiting={true} />)
}

export default load
