import {DeviceID} from './rpc-gen'
import {DeviceType} from './devices'

export type Device = {
  type: DeviceType
  name: string
  deviceID: DeviceID
}

export type State = Readonly<{
  popupOpen: boolean
  devices: Array<Device>
  paperkeyError?: string
  phase: 'dead' | 'promptOtherDevice' | 'paperKeyInput' | 'success'
  sessionID?: number
  waiting: boolean
}>
