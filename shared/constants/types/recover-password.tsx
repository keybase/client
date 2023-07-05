import {type Device} from '../provision'
import type * as RPCTypes from './rpc-gen'
import type HiddenString from '../../util/hidden-string'

export type State = {
  readonly devices: Array<Device>
  readonly error: HiddenString
  readonly explainedDevice?: {
    name: string
    type: RPCTypes.DeviceType
  }
  readonly paperKeyError: HiddenString
  readonly passwordError: HiddenString
  readonly resetEmailSent?: boolean
  readonly username: string
}
