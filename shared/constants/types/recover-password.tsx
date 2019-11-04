import * as I from 'immutable'
import * as ProvisionTypes from './provision'
import * as RPCTypes from './rpc-gen'
import HiddenString from '../../util/hidden-string'

export type _State = {
  devices: I.List<ProvisionTypes.Device>
  error: HiddenString
  explainedDevice?: {
    name: string
    type: RPCTypes.DeviceType
  }
  paperKeyError: HiddenString
  passwordError: HiddenString
  resetEmailSent?: boolean
  username: string
}

export type State = I.RecordOf<_State>
