import * as SettingsConstants from './settings'
import * as Tabs from './tabs'
import * as Types from './types/devices'
import * as WaitingConstants from './waiting'
import * as RPCTypes from './types/rpc-gen'
import * as Container from '../util/container'

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
