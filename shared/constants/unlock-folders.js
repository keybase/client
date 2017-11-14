// @flow
import type {DeviceID} from '../constants/types/flow-types'
import type {DeviceType} from '../constants/devices'

export type Device = {
  type: DeviceType,
  name: string,
  deviceID: DeviceID,
}

export type State = {
  closed: boolean,
  devices: ?Array<Device>,
  paperkeyError: ?string,
  phase: 'dead' | 'promptOtherDevice' | 'paperKeyInput' | 'success',
  sessionID: ?number,
  started: boolean,
  waiting: boolean,
}

const initialState: State = {
  closed: true,
  devices: null,
  paperkeyError: null,
  phase: 'dead',
  sessionID: null,
  started: false,
  waiting: false,
}

export {initialState}
