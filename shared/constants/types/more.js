// @flow

export type DeviceType = 'mobile' | 'computer' | 'paper key'

// Converts a string to the DeviceType enum, logging an error if it doesn't match
export function toDeviceType (s: string): DeviceType {
  switch (s) {
    case 'mobile':
    case 'computer':
    case 'paper key':
      return s
    default:
      console.error('Unknown Device Type %s. Defaulting to `computer`', s)
      return 'computer'
  }
}
