// @flow strict
// $FlowIssue https://github.com/facebook/flow/issues/6628
import * as I from 'immutable'
import type {DeviceID} from './rpc-gen'
import type {DeviceType} from './devices'

export type _Device = {
  type: DeviceType,
  name: string,
  deviceID: DeviceID,
}

export type Device = I.RecordOf<_Device>

export type _State = {
  popupOpen: boolean,
  devices: I.List<Device>,
  paperkeyError: ?string,
  phase: 'dead' | 'promptOtherDevice' | 'paperKeyInput' | 'success',
  sessionID: ?number,
  waiting: boolean,
}

export type State = I.RecordOf<_State>
