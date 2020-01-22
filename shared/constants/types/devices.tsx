import HiddenString from '../../util/hidden-string'
import * as RPCTypes from '../../constants/types/rpc-gen'

export type DeviceType = 'mobile' | 'desktop' | 'backup'
export type DeviceID = string

export type Device = {
  created: number
  currentDevice: boolean
  deviceID: DeviceID
  deviceNumberOfType: number
  lastUsed: number
  name: string
  provisionedAt?: number
  provisionerName?: string
  revokedAt?: number
  revokedByName?: string
  type: DeviceType
}

export type State = {
  deviceMap: Map<DeviceID, Device>
  endangeredTLFMap: Map<DeviceID, Set<string>>
  isNew: Set<string>
  justRevokedSelf: string
  newPaperkey: HiddenString
}

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

export function DeviceTypeV2ToString(s: RPCTypes.DeviceTypeV2): string {
  switch (s) {
    case RPCTypes.DeviceTypeV2.mobile:
      return 'mobile'
    case RPCTypes.DeviceTypeV2.desktop:
      return 'desktop'
    case RPCTypes.DeviceTypeV2.paper:
      return 'backup'
    default:
      console.log('Unknown Device Type %s. Defaulting to `desktop`', s)
      return 'desktop'
  }
}

export function StringToDeviceTypeV2(s: string): RPCTypes.DeviceTypeV2 {
  switch (s) {
    case 'mobile':
      return RPCTypes.DeviceTypeV2.mobile
    case 'desktop':
      return RPCTypes.DeviceTypeV2.desktop
    case 'backup':
      return RPCTypes.DeviceTypeV2.paper
    default:
      console.log('Unknown Device Type %s. Defaulting to `desktop`', s)
      return RPCTypes.DeviceTypeV2.desktop
  }
}

export function DeviceTypeV2ToDeviceType(s: RPCTypes.DeviceTypeV2): DeviceType {
  return DeviceTypeV2ToString(s) as DeviceType
}

export const stringToDeviceID = (s: string): DeviceID => s
export const deviceIDToString = (id: DeviceID): string => id
