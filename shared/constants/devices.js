// @flow
import HiddenString from '../util/hidden-string'
import {List} from 'immutable'

import type {DeviceDetail} from './types/flow-types'
import type {Device} from './types/more'
import type {TypedAction, NoErrorTypedAction} from './types/flux'

type IncomingDisplayPaperKeyPhrase = {params: {phrase: string}, response: {result: () => void}}

type DeviceRemoved = TypedAction<'devices:deviceRemoved', void, {errorText: string}>
type GeneratePaperKey = NoErrorTypedAction<'devices:generatePaperKey', void>
type LoadDevices = NoErrorTypedAction<'devices:loadDevices', void>
type LoadingDevices = NoErrorTypedAction<'devices:loadingDevices', void>
type PaperKeyLoaded = TypedAction<'devices:paperKeyLoaded', HiddenString, {errorText: string}>
type PaperKeyLoading = NoErrorTypedAction<'devices:paperKeyLoading', void>
type RemoveDevice = NoErrorTypedAction<'devices:removeDevice', {currentDevice: boolean, deviceID: string, name: string}>
type ShowDevices = TypedAction<'devices:showDevices', void, {errorText: string}>
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
  error: any,
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
