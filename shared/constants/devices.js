// @flow
import * as I from 'immutable'
import * as RPCTypes from './types/flow-types'
import * as SettingsConstants from './settings'
import * as Tabs from './tabs'
import {isMobile} from './platform'

// TODO could potentially use entities for devices provisioned by other devices but we still have
// to support pgp

type _DeviceDetail = {
  created: number,
  currentDevice: boolean,
  deviceID: string,
  lastUsed: number,
  name: string,
  provisionedAt: ?number,
  provisionerName: ?string,
  revokedAt: ?number,
  revokedByName: ?string,
  type: string,
}
export type DeviceDetail = I.RecordOf<_DeviceDetail>
const makeDeviceDetail: I.RecordFactory<_DeviceDetail> = I.Record({
  created: 0,
  currentDevice: false,
  deviceID: '',
  lastUsed: 0,
  name: '',
  provisionedAt: 0,
  provisionerName: null,
  revokedAt: null,
  revokedByName: null,
  type: '',
})

type _State = {
  deviceIDs: I.List<string>,
  waitingForServer: boolean,
}
export type State = I.RecordOf<_State>
const makeState: I.RecordFactory<_State> = I.Record({
  deviceIDs: I.List(),
  waitingForServer: false,
})

export type DeviceType = 'mobile' | 'desktop' | 'backup'
export type Device = {
  name: string,
  deviceID: RPCTypes.DeviceID,
  type: DeviceType,
  created: RPCTypes.Time,
  currentDevice: boolean,
  provisioner: ?RPCTypes.Device,
  provisionedAt: ?RPCTypes.Time,
  revokedAt: ?RPCTypes.Time,
  lastUsed: ?RPCTypes.Time,
}

// Converts a string to the DeviceType enum, logging an error if it doesn't match
function toDeviceType(s: string): DeviceType {
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

const devicesTabLocation = isMobile ? [Tabs.settingsTab, SettingsConstants.devicesTab] : [Tabs.devicesTab]

export {devicesTabLocation, makeState, makeDeviceDetail, toDeviceType}
