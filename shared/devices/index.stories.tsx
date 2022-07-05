import * as React from 'react'
import * as Sb from '../stories/storybook'
import {stringToDeviceID} from '../constants/types/devices'
import DevicesReal from './container'
import devicePage from './device-page/index.stories'
import deviceRevoke from './device-revoke/index.stories'
import paperKey from './paper-key/index.stories'
import addDevice from './add-device/index.stories'
import * as dateFns from 'date-fns'

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

const now = new Date()
const secondAgo = dateFns.sub(now, {seconds: 1})
const fourHoursAgo = dateFns.sub(now, {hours: 4})

const activeDevices = withNew => {
  const existingDevices = [
    {
      deviceNumberOfType: 0,
      id: stringToDeviceID('1'),
      isNew: false,
      key: '1',
      lastUsed: fourHoursAgo,
      type: 'device',
    },
    {
      deviceNumberOfType: 3,
      id: stringToDeviceID('2'),
      isNew: false,
      key: '2',
      lastUsed: fourHoursAgo,
      type: 'device',
    },
    {
      deviceNumberOfType: 7,
      id: stringToDeviceID('3'),
      isNew: false,
      key: '3',
      lastUsed: fourHoursAgo,
      type: 'device',
    },
  ]
  if (withNew) {
    return [
      ...existingDevices,
      {id: stringToDeviceID('6'), isNew: true, key: '6', lastUsed: fourHoursAgo, type: 'device'},
    ]
  }
  return existingDevices
}

const revokedDevices = withNew => {
  const existingDevices = [
    {
      deviceNumberOfType: 8,
      id: stringToDeviceID('4'),
      isNew: false,
      key: '4',
      revokedAt: fourHoursAgo,
      type: 'device',
    },
    {
      deviceNumberOfType: 9,
      id: stringToDeviceID('5'),
      isNew: false,
      key: '5',
      revokedAt: fourHoursAgo,
      type: 'device',
    },
  ]
  if (withNew) {
    return [
      ...existingDevices,
      {id: stringToDeviceID('7'), isNew: true, key: '7', revokedAt: secondAgo, type: 'device'},
    ]
  }
  return existingDevices
}

// Flow correctly complains about own props being incorrect
const Devices = (p: any) => <DevicesReal {...p} />

const provider = Sb.createPropProviderWithCommon({
  DeviceRow: ({deviceID}) => ({
    device: {
      currentDevice: deviceID === '1',
      deviceNumberOfType: 8,
      lastUsed: fourHoursAgo,
      name: {
        '1': 'laptop',
        '2': 'phone',
        '3': 'hello robot',
        '4': 'dog party',
        '5': 'desktop',
        '6': 'new device',
        '7': 'newly revoked',
      }[deviceID],
      revokedAt:
        deviceID === '4' || deviceID === '5' ? fourHoursAgo : deviceID === '7' ? secondAgo : undefined,
    },
    firstItem: deviceID === '1',
    iconNumber: Number(deviceID),
    isCurrentDevice: deviceID === '1',
    isNew: ['6', '7'].includes(String(deviceID)),
    isRevoked: !['1', '2', '3', '6'].includes(String(deviceID)),
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
    clearBadges: Sb.action('clearBadges'),
    hasNewlyRevoked: p.revoked.some(i => i.key === '7'),
    items: p.active,
    loadDevices: Sb.action('loaddevices'),
    onAddDevice: Sb.action('onAddDevice'),
    onBack: Sb.action('onBack'),
    revokedItems: p.revoked,
    title: 'Devices',
    waiting: !!p.waiting,
  }),
})

const load = () => {
  devicePage()
  deviceRevoke()
  paperKey()
  addDevice()
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
      <Devices
        _stateOverride={{revokedExpanded: true}}
        active={activeDevices(false)}
        revoked={revokedDevices(true)}
      />
    ))
}

export default load
