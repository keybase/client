import * as I from 'immutable'
import * as DeviceTypes from './types/devices'
import * as Types from './types/provision'
import * as RPCTypes from './types/rpc-gen'
import HiddenString from '../util/hidden-string'
import {CommonResponseHandler, RPCError} from '../engine/types'

export const waitingKey = 'provision:waiting'
export const forgotUsernameWaitingKey = 'provision:forgotUsername'

// Do NOT change this. These values are used by the daemon also so this way we can ignore it when they do it / when we do
export const errorCausedByUsCanceling = (e: RPCError | null) =>
  (e ? e.desc : undefined) === 'Input canceled' || (e ? e.desc : undefined) === 'kex canceled by caller'
export const cancelOnCallback = (_: any, response: CommonResponseHandler) => {
  response.error({code: RPCTypes.StatusCode.scinputcanceled, desc: 'Input canceled'})
}

export const makeState = I.Record<Types._State>({
  codePageIncomingTextCode: new HiddenString(''),
  codePageOtherDeviceId: '',
  codePageOtherDeviceName: '',
  codePageOtherDeviceType: 'mobile',
  codePageOutgoingTextCode: new HiddenString(''),
  deviceName: '',
  devices: I.List(),
  error: new HiddenString(''),
  existingDevices: I.List(),
  finalError: null,
  forgotUsernameResult: '',
  gpgImportError: null,
  initialUsername: '',
  inlineError: null,
  username: '',
})

const makeDevice = I.Record<Types._Device>({
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
