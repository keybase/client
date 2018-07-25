// @flow
import * as I from 'immutable'
import * as SettingsConstants from './settings'
import * as Tabs from './tabs'
import * as Types from './types/devices'
import * as WaitingConstants from './waiting'
import * as RPCTypes from './types/rpc-gen'
import {isMobile} from './platform'
import type {TypedState} from './reducer'

export const rpcDeviceToDevice = (d: RPCTypes.DeviceDetail): Types.Device =>
  makeDevice({
    created: d.device.cTime,
    currentDevice: d.currentDevice,
    deviceID: Types.stringToDeviceID(d.device.deviceID),
    lastUsed: d.device.lastUsedTime,
    name: d.device.name,
    provisionedAt: d.provisionedAt,
    provisionerName: d.provisioner ? d.provisioner.name : '',
    revokedAt: d.revokedAt,
    revokedByName: d.revokedByDevice ? d.revokedByDevice.name : null,
    type: Types.stringToDeviceType(d.device.type),
  })

const makeDevice: I.RecordFactory<Types._Device> = I.Record({
  created: 0,
  currentDevice: false,
  deviceID: Types.stringToDeviceID(''),
  lastUsed: 0,
  name: '',
  provisionedAt: 0,
  provisionerName: null,
  revokedAt: null,
  revokedByName: null,
  type: Types.stringToDeviceType('desktop'),
})

export const makeState: I.RecordFactory<Types._State> = I.Record({
  deviceMap: I.Map(),
  endangeredTLFMap: I.Map(),
selectedDeviceID: null
})

const emptyDevice = makeDevice()
export const devicesTabLocation = isMobile
  ? [Tabs.settingsTab, SettingsConstants.devicesTab]
  : [Tabs.devicesTab]
export const waitingKey = 'devices:devicesPage'

export const isWaiting = (state: TypedState) => WaitingConstants.anyWaiting(state, waitingKey)
export const getDevice = (state: TypedState, id: Types.DeviceID) =>
  state.devices.deviceMap.get(id, emptyDevice)
