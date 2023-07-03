import type * as DeviceTypes from './devices'

export type Device = {
  deviceNumberOfType: number
  id: DeviceTypes.DeviceID
  name: string
  type: DeviceTypes.DeviceType
}

export type State = {
  // if the entire process is dead, we store the whole error so we can render a lot of details about it
  forgotUsernameResult: string
  // username: string
  // initialUsername: string
  // deviceName: string
}
