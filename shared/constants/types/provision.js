// @flow
import * as I from 'immutable'
import * as DeviceTypes from './devices'
import HiddenString from '../../util/hidden-string'

export type _Device = {|
  id: DeviceTypes.DeviceID,
  name: string,
  type: DeviceTypes.DeviceType,
|}
export type Device = I.RecordOf<_Device>

export type _State = {
  codePageOtherDeviceName: string,
  codePageOtherDeviceType: 'mobile' | 'desktop',
  codePageOtherDeviceId: string,
  codePageTextCode: HiddenString,
  // shared by all errors, we only ever want one error
  error: HiddenString,
  usernameOrEmail: string,
  deviceName: string,
  devices: I.List<Device>,
  existingDevices: I.List<string>,
}

export type State = I.RecordOf<_State>
