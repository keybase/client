import * as T from '@/constants/types'

export const rpcDeviceToDevice = (d: T.RPCGen.DeviceDetail): T.Devices.Device => ({
  created: d.device.cTime,
  currentDevice: d.currentDevice,
  deviceID: T.Devices.stringToDeviceID(d.device.deviceID),
  deviceNumberOfType: d.device.deviceNumberOfType,
  lastUsed: d.device.lastUsedTime,
  name: d.device.name,
  provisionedAt: d.provisionedAt || undefined,
  provisionerName: d.provisioner ? d.provisioner.name : undefined,
  revokedAt: d.revokedAt || undefined,
  revokedByName: d.revokedByDevice ? d.revokedByDevice.name : undefined,
  type: T.Devices.stringToDeviceType(d.device.type),
})
