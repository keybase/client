import type * as DeviceTypes from './devices'
import type HiddenString from '../../util/hidden-string'
import type {RPCError} from '../../util/errors'

export type Device = {
  readonly deviceNumberOfType: number
  readonly id: DeviceTypes.DeviceID
  readonly name: string
  readonly type: DeviceTypes.DeviceType
}

export type State = {
  readonly codePageOtherDevice: Device
  // Code from the daemon
  readonly codePageIncomingTextCode: HiddenString
  // Code from other device
  readonly codePageOutgoingTextCode: HiddenString
  // shared by all errors, we only ever want one error
  readonly error: HiddenString
  // if the entire process is dead, we store the whole error so we can render a lot of details about it
  readonly finalError?: RPCError
  readonly forgotUsernameResult: string
  readonly inlineError?: RPCError
  readonly username: string
  readonly initialUsername: string
  readonly deviceName: string
  readonly devices: Array<Device>
  readonly gpgImportError?: string
  readonly existingDevices: Array<string>
}
