import * as I from 'immutable'
import * as DeviceTypes from './devices'
import HiddenString from '../../util/hidden-string'
import {RPCError} from '../../util/errors'

export type _Device = {
  id: DeviceTypes.DeviceID
  name: string
  type: DeviceTypes.DeviceType
}
export type Device = I.RecordOf<_Device>

export type _State = {
  codePageOtherDeviceName: string
  codePageOtherDeviceType: 'mobile' | 'desktop'
  codePageOtherDeviceId: string
  // Code from the daemon
  codePageIncomingTextCode: HiddenString
  // Code from other device
  codePageOutgoingTextCode: HiddenString
  // shared by all errors, we only ever want one error
  error: HiddenString
  // if the entire process is dead, we store the whole error so we can render a lot of details about it
  finalError: RPCError | null
  forgotUsernameResult: string
  inlineError: RPCError | null
  username: string
  initialUsername: string
  deviceName: string
  devices: I.List<Device>
  gpgImportError: string | null
  existingDevices: I.List<string>
}

export type State = I.RecordOf<_State>
