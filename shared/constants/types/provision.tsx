import type * as DeviceTypes from './devices'
import type HiddenString from '../../util/hidden-string'
import type {RPCError} from '../../util/errors'

export type Device = {
  deviceNumberOfType: number
  id: DeviceTypes.DeviceID
  name: string
  type: DeviceTypes.DeviceType
}

export type State = {
  // Code from the daemon
  codePageIncomingTextCode: HiddenString
  // Code from other device
  codePageOutgoingTextCode: HiddenString
  // if the entire process is dead, we store the whole error so we can render a lot of details about it
  finalError?: RPCError
  forgotUsernameResult: string
  inlineError?: RPCError
  // username: string
  // initialUsername: string
  // deviceName: string
}
