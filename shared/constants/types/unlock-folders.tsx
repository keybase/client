import type {DeviceID} from './rpc-gen'
import type {DeviceType} from './devices'

export type Device = {
  type: DeviceType
  name: string
  deviceID: DeviceID
}

export type State = {
  readonly popupOpen: boolean
  readonly devices: Array<Device>
  readonly paperkeyError?: string
  readonly phase: 'dead' | 'promptOtherDevice' | 'paperKeyInput' | 'success'
  readonly sessionID?: number
  readonly waiting: boolean
}
