import * as I from 'immutable'
import {DeviceID} from './rpc-gen'
import {DeviceType} from './devices'

export type _Device = {
  type: DeviceType
  name: string
  deviceID: DeviceID
}

export type Device = I.RecordOf<_Device>

export type _State = {
  popupOpen: boolean
  devices: I.List<Device>
  paperkeyError: string | null
  phase: 'dead' | 'promptOtherDevice' | 'paperKeyInput' | 'success'
  sessionID: number | null
  waiting: boolean
}

export type State = I.RecordOf<_State>
