import * as I from 'immutable'
import * as ProvisionTypes from './provision'
import HiddenString from '../../util/hidden-string'

export type _State = {
  devices: I.List<ProvisionTypes.Device>
  error: HiddenString
  explainedDevice?: {
    name: string
    type: string
  }
  paperKeyError: HiddenString
  username: string
}

export type State = I.RecordOf<_State>
