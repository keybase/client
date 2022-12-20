import * as DeviceTypes from './types/devices'
import type * as Types from './types/provision'
import * as RPCTypes from './types/rpc-gen'
import HiddenString from '../util/hidden-string'
import type {CommonResponseHandler, RPCError} from '../engine/types'

export const waitingKey = 'provision:waiting'
export const forgotUsernameWaitingKey = 'provision:forgotUsername'

// Do NOT change this. These values are used by the daemon also so this way we can ignore it when they do it / when we do
export const errorCausedByUsCanceling = (e: RPCError | null) =>
  (e ? e.desc : undefined) === 'Input canceled' || (e ? e.desc : undefined) === 'kex canceled by caller'
export const cancelOnCallback = (_: any, response: CommonResponseHandler) => {
  response.error({code: RPCTypes.StatusCode.scinputcanceled, desc: 'Input canceled'})
}

export const makeDevice = (): Types.Device => ({
  deviceNumberOfType: 0,
  id: DeviceTypes.stringToDeviceID(''),
  name: '',
  type: 'mobile',
})

export const makeState = (): Types.State => ({
  codePageIncomingTextCode: new HiddenString(''),
  codePageOtherDevice: makeDevice(),
  codePageOutgoingTextCode: new HiddenString(''),
  deviceName: '',
  devices: [],
  error: new HiddenString(''),
  existingDevices: [],
  forgotUsernameResult: '',
  initialUsername: '',
  username: '',
})

export const rpcDeviceToDevice = (d: RPCTypes.Device) => {
  const type = d.type
  switch (type) {
    case 'mobile':
    case 'desktop':
    case 'backup':
      return {
        deviceNumberOfType: d.deviceNumberOfType,
        id: DeviceTypes.stringToDeviceID(d.deviceID),
        name: d.name,
        type: type,
      }
    default:
      throw new Error('Invalid device type detected: ' + type)
  }
}

export const decodeForgotUsernameError = (error: RPCError) => {
  switch (error.code) {
    case RPCTypes.StatusCode.scnotfound:
      return "We couldn't find an account with that email address. Try again?"
    case RPCTypes.StatusCode.scinputerror:
      return "That doesn't look like a valid email address. Try again?"
    default:
      return error.desc
  }
}

export const cleanDeviceName = (name: string) =>
  // map 'smart apostrophes' to ASCII (typewriter apostrophe)
  name.replace(/[\u2018\u2019\u0060\u00B4]/g, "'")

// Copied from go/libkb/checkers.go
export const goodDeviceRE = /^[a-zA-Z0-9][ _'a-zA-Z0-9+‘’—–-]*$/
// eslint-disable-next-line
export const badDeviceRE = /  |[ '_-]$|['_-][ ]?['_-]/
export const normalizeDeviceRE = /[^a-zA-Z0-9]/

export const deviceNameInstructions =
  'Your device name must have 3-64 characters and not end with punctuation.'

export const badDeviceChars = /[^a-zA-Z0-9-_' ]/g
