// @flow
import * as I from 'immutable'
import * as RPCTypes from './flow-types'

// TODO could potentially use entities for devices provisioned by other devices but we still have
// to support pgp
export type _DeviceDetail = {
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
export type _State = {
  deviceIDs: I.List<string>,
  waitingForServer: boolean,
}
export type State = I.RecordOf<_State>
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
