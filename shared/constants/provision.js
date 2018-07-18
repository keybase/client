// @flow
import * as I from 'immutable'
import * as DeviceTypes from './types/devices'
import * as Types from './types/provision'
import * as RPCTypes from './types/rpc-gen'
import HiddenString from '../util/hidden-string'

export const waitingKey = 'provision:waiting'

export const makeState: I.RecordFactory<Types._State> = I.Record({
  codePageOtherDeviceId: '',
  codePageOtherDeviceName: '',
  codePageOtherDeviceType: 'mobile',
  codePageTextCode: new HiddenString(''),
  configuredAccounts: I.List(),
  deviceName: '',
  devices: I.List(),
  error: new HiddenString(''),
  existingDevices: I.List(),
  finalError: null,
  selectedDevice: null,
  usernameOrEmail: '',
})

const makeDevice: I.RecordFactory<Types._Device> = I.Record({
  id: DeviceTypes.stringToDeviceID(''),
  name: '',
  type: 'mobile',
})

export const rpcDeviceToDevice = (d: RPCTypes.Device) => {
  const type = d.type
  switch (type) {
    case 'mobile':
    case 'desktop':
    case 'backup':
      return makeDevice({
        id: DeviceTypes.stringToDeviceID(d.deviceID),
        name: d.name,
        type: type,
      })
    default:
      throw new Error('Invalid device type detected: ' + type)
  }
}

export const cleanDeviceName = (name: string) =>
  name
    // lower case alpha numerics
    .replace(/[^a-zA-Z0-9]/g, '')
    // map 'smart apostrophes' to ASCII (typewriter apostrophe)
    .replace(/[\u2018\u2019\u0060\u00B4]/g, "'")
    .toLowerCase()
