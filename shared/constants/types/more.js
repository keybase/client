// @flow

import type {Device as _Device} from './flow-types'

export type DeviceType = 'mobile' | 'desktop' | 'backup'
export type Device = {type: DeviceType} & _Device

// Converts a string to the DeviceType enum, logging an error if it doesn't match
export function toDeviceType (s: string): DeviceType {
  switch (s) {
    case 'mobile':
    case 'desktop':
    case 'backup':
      return s
    default:
      console.warn('Unknown Device Type %s. Defaulting to `desktop`', s)
      return 'desktop'
  }
}
