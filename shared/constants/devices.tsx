import * as SettingsConstants from './settings'
import * as Tabs from './tabs'
import * as Types from './types/devices'
import * as WaitingConstants from './waiting'
import type * as RPCTypes from './types/rpc-gen'
import * as Container from '../util/container'
import {memoize} from '../util/memoize'

export const rpcDeviceToDevice = (d: RPCTypes.DeviceDetail): Types.Device =>
  makeDevice({
    created: d.device.cTime,
    currentDevice: d.currentDevice,
    deviceID: Types.stringToDeviceID(d.device.deviceID),
    deviceNumberOfType: d.device.deviceNumberOfType,
    lastUsed: d.device.lastUsedTime,
    name: d.device.name,
    provisionedAt: d.provisionedAt || undefined,
    provisionerName: d.provisioner ? d.provisioner.name : undefined,
    revokedAt: d.revokedAt || undefined,
    revokedByName: d.revokedByDevice ? d.revokedByDevice.name : undefined,
    type: Types.stringToDeviceType(d.device.type),
  })

const emptyDevice: Types.Device = {
  created: 0,
  currentDevice: false,
  deviceID: Types.stringToDeviceID(''),
  deviceNumberOfType: 0,
  lastUsed: 0,
  name: '',
  type: Types.stringToDeviceType('desktop'),
}

export const makeDevice = (d?: Partial<Types.Device>): Types.Device =>
  d ? Object.assign({...emptyDevice}, d) : emptyDevice

export const devicesTabLocation = Container.isMobile
  ? Container.isTablet
    ? ([Tabs.settingsTab] as const)
    : ([Tabs.settingsTab, SettingsConstants.devicesTab] as const)
  : ([Tabs.devicesTab] as const)
export const waitingKey = 'devices:devicesPage'

export const isWaiting = (state: Container.TypedState) => WaitingConstants.anyWaiting(state, waitingKey)
export const getDevice = (state: Container.TypedState, id?: Types.DeviceID) =>
  (id && state.devices.deviceMap.get(id)) || emptyDevice

type DeviceCounts = {
  numActive: number
  numRevoked: number
}
export const getDeviceCounts = (state: Container.TypedState) =>
  [...state.devices.deviceMap.values()].reduce<DeviceCounts>(
    (c, v) => {
      if (v.revokedAt) {
        c.numRevoked++
      } else {
        c.numActive++
      }
      return c
    },
    {numActive: 0, numRevoked: 0}
  )

const emptySet = new Set<string>()
export const getEndangeredTLFs = (state: Container.TypedState, id?: Types.DeviceID): Set<string> =>
  (id && state.devices.endangeredTLFMap.get(id)) || emptySet

// Utils for mapping a device to one of the icons

// Icons are numbered 1-10, so this focuses on mapping
// Device -> [1, 10]
// We split devices by type and order them by creation time. Then, we use (index mod 10)
// as the background #
export const numBackgrounds = 10

export const getDeviceIconNumberInner = (
  devices: Map<Types.DeviceID, Types.Device>,
  deviceID: Types.DeviceID
): Types.IconNumber =>
  (((devices.get(deviceID) || {deviceNumberOfType: 0}).deviceNumberOfType % numBackgrounds) + 1) as any

const getNextDeviceIconNumberInner = memoize((devices: Map<Types.DeviceID, Types.Device>) => {
  // Find the max device number and add one (+ one more since these are 1-indexed)
  const result = {backup: 1, desktop: 1, mobile: 1}
  devices.forEach(device => {
    if (device.deviceNumberOfType >= result[device.type]) {
      result[device.type] = device.deviceNumberOfType + 1
    }
  })
  return {desktop: (result.desktop % numBackgrounds) + 1, mobile: (result.mobile % numBackgrounds) + 1}
})

export const getDeviceIconNumber = (state: Container.TypedState, deviceID: Types.DeviceID) =>
  getDeviceIconNumberInner(state.devices.deviceMap, deviceID)
export const getNextDeviceIconNumber = (state: Container.TypedState) =>
  getNextDeviceIconNumberInner(state.devices.deviceMap)
