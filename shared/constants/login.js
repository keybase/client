// @flow
import * as I from 'immutable'
import * as DeviceTypes from './types/devices'
import * as Types from './types/login'
import * as RPCTypes from './types/rpc-gen'
import HiddenString from '../util/hidden-string'

export const waitingKey = 'login:waiting'

export const makeAccount: I.RecordFactory<Types._Account> = I.Record({
  hasStoredSecret: false,
  username: '',
})

export const makeState: I.RecordFactory<Types._State> = I.Record({
  codePageOtherDeviceName: '',
  codePageOtherDeviceType: 'phone',
  codePageTextCode: new HiddenString(''),
  configuredAccounts: I.List(),
  error: '',
  forgotPasswordError: null,
  forgotPasswordSubmitting: false,
  forgotPasswordSuccess: false,
  justDeletedSelf: null,
  justRevokedSelf: null,
  provisionDevices: I.List(),
  provisionDevicesCanSelectNoDevice: false,
  provisionExistingDevices: I.List(),
  provisionSelectedDevice: null,
  provisionUsernameOrEmail: '',
  registerUserPassLoading: false,
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
