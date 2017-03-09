// @flow
import HiddenString from '../util/hidden-string'
import {List} from 'immutable'

import type {DeviceDetail} from './types/flow-types'
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

type State = {
  waitingForServer: boolean,
  devices: List<DeviceDetail>,
  paperKey: ?string,
}

export type {
  Actions,
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
