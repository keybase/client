// @flow
import * as I from 'immutable'
import * as DeviceTypes from './types/devices'
import * as Types from './types/provision'
import * as RPCTypes from './types/rpc-gen'
import HiddenString from '../util/hidden-string'

export const waitingKey = 'provision:waiting'

// Do NOT change this. These values are used by the daemon also so this way we can ignore it when they do it / when we do
export const errorCausedByUsCanceling = (e: Error) => e?.desc === 'Input canceled' || e?.desc ===  'kex canceled by caller'

export const makeState: I.RecordFactory<Types._State> = I.Record({
  codePageIncomingTextCode: new HiddenString(''),
  codePageOtherDeviceId: '',
  codePageOtherDeviceName: '',
  codePageOtherDeviceType: 'mobile',
  codePageOutgoingTextCode: new HiddenString(''),
  configuredAccounts: I.List(),
  deviceName: '',
  devices: I.List(),
  error: new HiddenString(''),
  existingDevices: I.List(),
  finalError: null,
  gpgImportError: null,
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
  // map 'smart apostrophes' to ASCII (typewriter apostrophe)
  name.replace(/[\u2018\u2019\u0060\u00B4]/g, "'")
