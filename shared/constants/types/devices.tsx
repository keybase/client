export type DeviceType = 'mobile' | 'desktop' | 'backup'
export type DeviceID = string

export type Device = {
  created: number
  currentDevice: boolean
  deviceID: DeviceID
  deviceNumberOfType: number
  lastUsed: number
  name: string
  provisionedAt?: number | undefined
  provisionerName?: string | undefined
  revokedAt?: number | undefined
  revokedByName?: string | undefined
  type: DeviceType
}

export const numBackgrounds = 10
export const deviceNumberToIconNumber = (deviceNumberOfType: number) =>
  (((deviceNumberOfType % numBackgrounds) + 1) as IconNumber)

export const nextDeviceIconNumbers = (
  devices: ReadonlyArray<Pick<Device, 'deviceNumberOfType' | 'type'>>
): {desktop: IconNumber; mobile: IconNumber} => {
  const result = {backup: 1, desktop: 1, mobile: 1}
  devices.forEach(device => {
    if (device.deviceNumberOfType >= result[device.type]) {
      result[device.type] = device.deviceNumberOfType + 1
    }
  })
  return {
    desktop: deviceNumberToIconNumber(result.desktop),
    mobile: deviceNumberToIconNumber(result.mobile),
  }
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
