import * as I from 'immutable'
import * as ProvisionTypes from './provision'
import HiddenString from '../../util/hidden-string'

export type _State = {
  error: HiddenString
  username: string
  deviceName: string
  devices: I.List<ProvisionTypes.Device>
}

export type State = I.RecordOf<_State>
