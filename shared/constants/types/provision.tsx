import * as DeviceTypes from './devices'
import HiddenString from '../../util/hidden-string'
import {RPCError} from '../../util/errors'

export type Device = {
  deviceNumberOfType: number
  id: DeviceTypes.DeviceID
  name: string
  type: DeviceTypes.DeviceType
}

export type State = Readonly<{
  codePageOtherDevice: Device
  // Code from the daemon
  codePageIncomingTextCode: HiddenString
  // Code from other device
  codePageOutgoingTextCode: HiddenString
  // shared by all errors, we only ever want one error
  error: HiddenString
  // if the entire process is dead, we store the whole error so we can render a lot of details about it
  finalError?: RPCError
  forgotUsernameResult: string
  inlineError?: RPCError
  username: string
  initialUsername: string
  deviceName: string
  devices: ReadonlyArray<Device>
  gpgImportError?: string
  existingDevices: Array<string>
}>
