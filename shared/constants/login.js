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
  codePageTextCodeError: '',
  configuredAccounts: I.List(),
  devicenameError: '',
  forgotPasswordError: null,
  forgotPasswordSubmitting: false,
  forgotPasswordSuccess: false,
  justDeletedSelf: null,
  justRevokedSelf: null,
  loginError: '',
  provisionDevices: I.List(),
  provisionDevicesCanSelectNoDevice: false,
  provisionSelectedDevice: null,
  provisionUsernameOrEmail: '',
  registerUserPassError: null,
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
