// @flow
import type {DeviceID} from './flow-types'
import type {DeviceType} from './devices'

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
  waiting: boolean,
}
