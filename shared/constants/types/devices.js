// @flow
import * as I from 'immutable'
import type {IconType} from '../../common-adapters'
import {isMobile} from '../../styles'

export type DeviceType = 'mobile' | 'desktop' | 'backup'
export opaque type DeviceID: string = string
export type _DeviceDetail = {
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
export type DeviceDetail = I.RecordOf<_DeviceDetail>
export type _State = {
  idToDetail: I.Map<DeviceID, DeviceDetail>,
  idToEndangeredTLFs: I.Map<DeviceID, I.Set<string>>,
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

export function deviceTypeToIconType(type: DeviceType): IconType {
  return {
    backup: isMobile ? 'icon-paper-key-revoke-64' : 'icon-paper-key-revoke-48',
    desktop: isMobile ? 'icon-computer-revoke-64' : 'icon-computer-revoke-48',
    mobile: isMobile ? 'icon-phone-revoke-64' : 'icon-phone-revoke-48',
  }[type]
}

export function stringToDeviceID(s: string): DeviceID {
  return s
}

export function deviceIDToString(id: DeviceID): string {
  return id
}
