// @flow
import HiddenString from '../util/hidden-string'
import {List, Record} from 'immutable'

import type {Device} from './types/more'
import type {TypedAction, NoErrorTypedAction} from './types/flux'

type IncomingDisplayPaperKeyPhrase = {params: {phrase: string}, response: {result: () => void}}

type DeviceRemoved = NoErrorTypedAction<'devices:deviceRemoved', void>
type GeneratePaperKey = NoErrorTypedAction<'devices:generatePaperKey', void>
type LoadDevices = NoErrorTypedAction<'devices:loadDevices', void>
type LoadingDevices = NoErrorTypedAction<'devices:loadingDevices', void>
type PaperKeyLoaded = NoErrorTypedAction<'devices:paperKeyLoaded', {paperKey: HiddenString}>
type PaperKeyLoading = NoErrorTypedAction<'devices:paperKeyLoading', void>
type RemoveDevice = NoErrorTypedAction<'devices:removeDevice', {currentDevice: boolean, deviceID: string, name: string}>
type ShowDevices = NoErrorTypedAction<'devices:showDevices', {devices: Array<DeviceDetail>}>
type ShowRemovePage = NoErrorTypedAction<'devices:showRemovePage', {device: Device}>

type Actions = DeviceRemoved
| GeneratePaperKey
| LoadDevices
| LoadingDevices
| PaperKeyLoaded
| PaperKeyLoading
| RemoveDevice
| ShowDevices
| ShowRemovePage

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
  revokedBy: ?string,
  type: string,
}>

const StateRecord = Record({
  waitingForServer: false,
  devices: List(),
  paperKey: null,
})

type State = Record<{
  waitingForServer: boolean,
  devices: List<DeviceDetail>,
  paperKey: ?string,
}>

export type {
  Actions,
  DeviceDetail,
  DeviceRemoved,
  GeneratePaperKey,
  IncomingDisplayPaperKeyPhrase,
  LoadDevices,
  LoadingDevices,
  PaperKeyLoaded,
  PaperKeyLoading,
  RemoveDevice,
  ShowDevices,
  ShowRemovePage,
  State,
}

export {
  DeviceDetailRecord,
  StateRecord,
}
