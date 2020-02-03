import * as ProvisionTypes from './provision'
import * as RPCTypes from './rpc-gen'
import HiddenString from '../../util/hidden-string'

export type State = {
  readonly devices: Array<ProvisionTypes.Device>
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
