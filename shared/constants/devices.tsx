import * as SettingsConstants from './settings'
import * as Tabs from './tabs'
import * as Types from './types/devices'
import * as WaitingConstants from './waiting'
import * as RPCTypes from './types/rpc-gen'
import * as Container from '../util/container'
import {memoize} from '../util/memoize'

export const rpcDeviceToDevice = (d: RPCTypes.DeviceDetail): Types.Device =>
  makeDevice({
    created: d.device.cTime,
    currentDevice: d.currentDevice,
    deviceID: Types.stringToDeviceID(d.device.deviceID),
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
  lastUsed: 0,
  name: '',
  type: Types.stringToDeviceType('desktop'),
}

export const makeDevice = (d?: Partial<Types.Device>): Types.Device =>
  d ? Object.assign({...emptyDevice}, d) : emptyDevice

export const devicesTabLocation = Container.isMobile
  ? [Tabs.settingsTab, SettingsConstants.devicesTab]
  : [Tabs.devicesTab]
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

export const getEndangeredTLFs = (state: Container.TypedState, id?: Types.DeviceID): Set<string> =>
  (id && state.devices.endangeredTLFMap.get(id)) || Container.emptySet

// Utils for mapping a device to one of the icons

// Icons are numbered 1-10, so this focuses on mapping
// Device -> [1, 10]
// We split devices by type and order them by creation time. Then, we use (index mod 10)
// as the background #
const numBackgrounds = 10
const idxMapper = (device: Types.Device, idx: number): [Types.DeviceID, number] => [
  device.deviceID,
  (idx % numBackgrounds) + 1,
]
type DeviceIconInfo = {
  map: Map<Types.DeviceID, number>
  next: {desktop: number; mobile: number}
}
const getIndexMap = memoize(
  (devices: Map<Types.DeviceID, Types.Device>): DeviceIconInfo => {
    const sorted = [...devices.values()]
      .sort((a, b) => a.created - b.created)
      .reduce<{
        backup: Array<Types.Device>
        desktop: Array<Types.Device>
        mobile: Array<Types.Device>
      }>(
        (res, device) => {
          switch (device.type) {
            case 'backup':
              res.backup.push(device)
              break
            case 'desktop':
              res.desktop.push(device)
              break
            case 'mobile':
              res.mobile.push(device)
              break
          }
          return res
        },
        {backup: [], desktop: [], mobile: []}
      )
    return {
      map: new Map([
        ...sorted.backup.map(idxMapper),
        ...sorted.desktop.map(idxMapper),
        ...sorted.mobile.map(idxMapper),
      ]),
      next: {
        desktop: (sorted.desktop.length % numBackgrounds) + 1,
        mobile: (sorted.mobile.length % numBackgrounds) + 1,
      },
    }
  }
)

// cache deviceID -> number forever
const deviceIconNumberCache = {}
export const getDeviceIconNumberInner = (
  devices: Map<Types.DeviceID, Types.Device>,
  deviceID: Types.DeviceID
): number => {
  if (deviceIconNumberCache[deviceID]) {
    return deviceIconNumberCache[deviceID]
  }
  const idx = getIndexMap(devices).map.get(deviceID)
  if (idx !== undefined) {
    deviceIconNumberCache[deviceID] = idx
    return idx
  }
  return -1
}

const getNextDeviceIconNumberInner = (devices: Map<Types.DeviceID, Types.Device>) => getIndexMap(devices).next

export const getDeviceIconNumber = (state: Container.TypedState, deviceID: Types.DeviceID) =>
  getDeviceIconNumberInner(state.devices.deviceMap, deviceID)
export const getNextDeviceIconNumber = (state: Container.TypedState) =>
  getNextDeviceIconNumberInner(state.devices.deviceMap)
