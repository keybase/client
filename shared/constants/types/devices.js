// @flow strict
import * as I from 'immutable'
import HiddenString from '../../util/hidden-string'

export type DeviceType = 'mobile' | 'desktop' | 'backup'
export opaque type DeviceID: string = string

export type _Device = {
  created: number,
  currentDevice: boolean,
  deviceID: DeviceID,
  lastUsed: number,
  name: string,
  provisionedAt: ?number,
  provisionerName: ?string,
  revokedAt: ?number,
  revokedByName: ?string,
  type: DeviceType,
}
export type Device = I.RecordOf<_Device>

export type _State = {
  deviceMap: I.Map<DeviceID, Device>,
  endangeredTLFMap: I.Map<DeviceID, I.Set<string>>,
  newPaperkey: HiddenString,
  selectedDeviceID: ?DeviceID,
  justRevokedSelf: string,
  isNew: I.Set<string>,
}
export type State = I.RecordOf<_State>

// Converts a string to the DeviceType enum, logging an error if it doesn't match
export function stringToDeviceType(s: string): DeviceType {
  switch (s) {
    case 'mobile':
    case 'desktop':
    case 'backup':
      return s
    default:
      console.log('Unknown Device Type %s. Defaulting to `desktop`', s)
      return 'desktop'
  }
}

export const stringToDeviceID = (s: string): DeviceID => s
export const deviceIDToString = (id: DeviceID): string => id
