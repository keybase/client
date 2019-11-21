import * as ProvisionTypes from './provision'
import * as RPCTypes from './rpc-gen'
import HiddenString from '../../util/hidden-string'

export type State = Readonly<{
  devices: Array<ProvisionTypes.Device>
  error: HiddenString
  explainedDevice?: {
    name: string
    type: RPCTypes.DeviceType
  }
  paperKeyError: HiddenString
  passwordError: HiddenString
  resetEmailSent?: boolean
  username: string
}>
