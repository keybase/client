import * as T from './types'
import {uint8ArrayToString} from 'uint8array-extras'

type Device = {
  deviceNumberOfType: number
  id: T.Devices.DeviceID
  name: string
  type: T.Devices.DeviceType
}

export const bodyToJSON = (body?: Uint8Array): unknown => {
  if (!body) return undefined
  try {
    return JSON.parse(uint8ArrayToString(body))
  } catch {
    return undefined
  }
}

export const rpcDeviceToDevice = (d: T.RPCGen.Device): Device => {
  const type = d.type
  switch (type) {
    case 'mobile':
    case 'desktop':
    case 'backup':
      return {
        deviceNumberOfType: d.deviceNumberOfType,
        id: T.Devices.stringToDeviceID(d.deviceID),
        name: d.name,
        type: type,
      }
    default:
      throw new Error('Invalid device type detected: ' + type)
  }
}
