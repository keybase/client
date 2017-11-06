// @flow
import * as I from 'immutable'
import * as RPCTypes from './types/flow-types'
import type {NoErrorTypedAction} from './types/flux'

export type Load = NoErrorTypedAction<'devices:load', void>
export type Loaded = NoErrorTypedAction<'devices:loaded', {deviceIDs: Array<string>}>
export type PaperKeyMake = NoErrorTypedAction<'devices:paperKeyMake', void>
export type Revoke = NoErrorTypedAction<'devices:revoke', {deviceID: string}>
export type ShowRevokePage = NoErrorTypedAction<'devices:showRevokePage', {deviceID: string}>
export type Waiting = NoErrorTypedAction<'devices:waiting', {waiting: boolean}>

export type Actions = Load | Loaded | PaperKeyMake | Revoke | ShowRevokePage | Waiting

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

export {makeState, makeDeviceDetail, toDeviceType}
