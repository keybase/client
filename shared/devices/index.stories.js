// @flow
import * as React from 'react'
import * as Sb from '../stories/storybook'
import {stringToDeviceID} from '../constants/types/devices'
import DevicesReal from './container'
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

const activeDevices = withNew => {
  const existingDevices = [
    {id: stringToDeviceID('1'), key: '1', type: 'device', isNew: false},
    {id: stringToDeviceID('2'), key: '2', type: 'device', isNew: false},
    {id: stringToDeviceID('3'), key: '3', type: 'device', isNew: false},
  ]
  if (withNew) {
    return [...existingDevices, {id: stringToDeviceID('6'), key: '6', type: 'device', isNew: true}]
  }
  return existingDevices
}

const revokedDevices = withNew => {
  const existingDevices = [
    {id: stringToDeviceID('4'), key: '4', type: 'device', isNew: false},
    {id: stringToDeviceID('5'), key: '5', type: 'device', isNew: false},
  ]
  if (withNew) {
    return [...existingDevices, {id: stringToDeviceID('7'), key: '7', type: 'device', isNew: true}]
  }
  return existingDevices
}

// Flow correctly complains about own props being incorrect
const Devices = (p: any) => <DevicesReal {...p} />

const provider = Sb.createPropProviderWithCommon({
  DeviceRow: ({deviceID}) => ({
    firstItem: deviceID === '1',
    isCurrentDevice: deviceID === '1',
    isRevoked: !['1', '2', '3', '6'].includes(deviceID),
    isNew: ['6', '7'].includes(deviceID),
    name: {
      '1': 'laptop',
      '2': 'phone',
      '3': 'hello robot',
      '4': 'dog party',
      '5': 'desktop',
      '6': 'new device',
      '7': 'newly revoked',
    }[deviceID],
    showExistingDevicePage: Sb.action('onShowExistingDevicePage'),
    type: idToType(deviceID),
  }),
  Devices: p => ({
    _stateOverride: p._stateOverride,
    hideMenu: Sb.action('hideMenu'),
    items: p.active,
    loadDevices: Sb.action('loaddevices'),
    menuItems: [
      {onClick: Sb.action('onAdd phone'), title: 'New phone'},
      {onClick: Sb.action('onAdd computer'), title: 'New computer'},
      {onClick: Sb.action('onAdd paper key'), title: 'New paper key'},
    ],
    revokedItems: p.revoked,
    hasNewlyRevoked: p.revoked.some(i => i.key === '7'),
    showMenu: Sb.action('showMenu'),
    showingMenu: false,
    waiting: !!p.waiting,
  }),
})

const load = () => {
  devicePage()
  deviceRevoke()
  paperKey()
  Sb.storiesOf('Devices/List', module)
    .addDecorator(provider)
    .add('Current computer', () => <Devices active={activeDevices(false)} revoked={revokedDevices(false)} />)
    .add('Revoked expanded', () => (
      <Devices
        _stateOverride={{revokedExpanded: true}}
        active={activeDevices(false)}
        revoked={revokedDevices(false)}
      />
    ))
    .add('Loading', () => (
      <Devices waiting={true} active={activeDevices(false)} revoked={revokedDevices(false)} />
    ))
    .add('Newly added device', () => <Devices active={activeDevices(true)} revoked={revokedDevices(false)} />)
    .add('Newly revoked device', () => (
      <Devices active={activeDevices(false)} revoked={revokedDevices(true)} />
    ))
}

export default load
