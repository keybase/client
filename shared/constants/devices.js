// @flow
import HiddenString from '../util/hidden-string'
import {List, Record} from 'immutable'

import type {Device} from './types/more'
import type {TypedAction, NoErrorTypedAction} from './types/flux'

type IncomingDisplayPaperKeyPhrase = {params: {phrase: string}, response: {result: () => void}}

type DeviceRemoved = NoErrorTypedAction<'devices:deviceRemoved', void>
type GeneratePaperKey = NoErrorTypedAction<'devices:generatePaperKey', void>
type LoadDevices = NoErrorTypedAction<'devices:loadDevices', void>
type LoadedDevices = NoErrorTypedAction<'devices:loadedDevices', {deviceIDs: Array<string>}>
type LoadingDevices = NoErrorTypedAction<'devices:loadingDevices', void>
type PaperKeyLoaded = NoErrorTypedAction<'devices:paperKeyLoaded', {paperKey: HiddenString}>
type PaperKeyLoading = NoErrorTypedAction<'devices:paperKeyLoading', void>
type RemoveDevice = NoErrorTypedAction<'devices:removeDevice', {currentDevice: boolean, deviceID: string, name: string}>
type ShowRemovePage = NoErrorTypedAction<'devices:showRemovePage', {device: Device}>

type Actions = DeviceRemoved
| GeneratePaperKey
| LoadDevices
| LoadedDevices
| LoadingDevices
| PaperKeyLoaded
| PaperKeyLoading
| RemoveDevice
| ShowRemovePage

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

type DeviceDetail = Record<{
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
  waitingForServer: false,
  deviceIDs: List(),
  paperKey: null,
})

type State = Record<{
  waitingForServer: boolean,
  deviceIDs: List<string>,
  paperKey: ?string,
}>

export type {
  Actions,
  DeviceDetail,
  DeviceRemoved,
  GeneratePaperKey,
  IncomingDisplayPaperKeyPhrase,
  LoadDevices,
  LoadedDevices,
  LoadingDevices,
  PaperKeyLoaded,
  PaperKeyLoading,
  RemoveDevice,
  ShowRemovePage,
  State,
}

export {
  DeviceDetailRecord,
  StateRecord,
}
