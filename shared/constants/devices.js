// @flow
import {List, Record} from 'immutable'

import type {Device} from './types/more'
import type {DeviceRole} from './login.js'
import type {NoErrorTypedAction} from './types/flux'

export type AddNewDevice = NoErrorTypedAction<
  'device:addNewDevice',
  {role: DeviceRole}
>
export type Load = NoErrorTypedAction<'devices:load', void>
export type Loaded = NoErrorTypedAction<
  'devices:loaded',
  {deviceIDs: Array<string>}
>
export type PaperKeyMake = NoErrorTypedAction<'devices:paperKeyMake', void>
export type Revoke = NoErrorTypedAction<'devices:revoke', {deviceID: string}>
export type ShowRevokePage = NoErrorTypedAction<
  'devices:showRevokePage',
  {deviceID: string}
>
export type Waiting = NoErrorTypedAction<'devices:waiting', {waiting: boolean}>

export type Actions =
  | Load
  | Loaded
  | PaperKeyMake
  | Revoke
  | ShowRevokePage
  | Waiting

// TODO could potentially use entities for devices provisioned by other devices but we still have
// to support pgp
const DeviceDetailRecord = Record({
  created: 0,
  currentDevice: false,
  deviceID: '',
  lastUsed: 0,
  name: '',
  provisionedAt: 0,
  provisioner: null,
  revokedAt: null,
  revokedBy: null,
  type: '',
})

export type DeviceDetail = Record<{
  created: number,
  currentDevice: boolean,
  deviceID: string,
  lastUsed: number,
  name: string,
  provisionedAt: number,
  provisioner: ?Device,
  revokedAt: ?number,
  revokedBy: ?Device,
  type: string,
}>

const StateRecord = Record({
  deviceIDs: List(),
  waitingForServer: false,
})

export type State = Record<{
  deviceIDs: List<string>,
  waitingForServer: boolean,
}>

export {DeviceDetailRecord, StateRecord}
