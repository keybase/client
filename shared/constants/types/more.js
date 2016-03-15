// @flow

// TODO: Kill this. We only need it because chooseDevice from the engine gives us these alternate types
export type ProvisionUI_ChooseDeviceType = 'mobile' | 'computer' | 'paper key'

export type DeviceType = 'mobile' | 'desktop' | 'backup'

// Converts a string to the DeviceType enum, logging an error if it doesn't match
export function toDeviceType (s: string): DeviceType {
  switch (s) {
    case 'mobile':
    case 'desktop':
    case 'backup':
      return s
    default:
      console.error('Unknown Device Type %s. Defaulting to `desktop`', s)
      return 'desktop'
  }
}
