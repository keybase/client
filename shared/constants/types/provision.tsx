import type * as DeviceTypes from './devices'
import type {RPCError} from '../../util/errors'

export type Device = {
  deviceNumberOfType: number
  id: DeviceTypes.DeviceID
  name: string
  type: DeviceTypes.DeviceType
}

export type State = {
  // if the entire process is dead, we store the whole error so we can render a lot of details about it
  finalError?: RPCError
  forgotUsernameResult: string
  inlineError?: RPCError
  // username: string
  // initialUsername: string
  // deviceName: string
}
