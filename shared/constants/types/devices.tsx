import type HiddenString from '../../util/hidden-string'

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

export const stringToDeviceID = (s: string): DeviceID => s
export const deviceIDToString = (id: DeviceID): string => id
export type IconNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
