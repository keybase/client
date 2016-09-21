// @flow
import HiddenString from '../util/hidden-string'

import type {TypedAction, NoErrorTypedAction} from './types/flux'

export const loadDevices = 'devices:loadDevices'
export type LoadDevices = NoErrorTypedAction<'devices:loadDevices', void>

export const loadingDevices = 'devices:loadingDevices'
export type LoadingDevices = NoErrorTypedAction<'devices:loadingDevices', void>

export const removeDevice = 'devices:removeDevice'
export type RemoveDevice = NoErrorTypedAction<'devices:removeDevice', {
  deviceID: string,
  name: string,
  currentDevice: boolean,
}>

export const deviceRemoved = 'devices:deviceRemoved'
export type DeviceRemoved = TypedAction<'devices:deviceRemoved', void, {errorText: string}>

export const paperKeyLoaded = 'devices:paperKeyLoaded'
export type PaperKeyLoaded = TypedAction<'devices:paperKeyLoaded', HiddenString, {errorText: string}>

export const paperKeyLoading = 'devices:paperKeyLoading'
export type PaperKeyLoading = NoErrorTypedAction<'devices:paperKeyLoading', void>

export const showDevices = 'devices:showDevices'
export type ShowDevices = TypedAction<'devices:showDevices', void, {errorText: string}>

export const generatePaperKey = 'devices:generatePaperKey'
export type GeneratePaperKey = NoErrorTypedAction<'devices:generatePaperKey', void>

export type IncomingDisplayPaperKeyPhrase = NoErrorTypedAction<'keybase.1.loginUi.displayPaperKeyPhrase', {params: {paperKey: HiddenString}, response: {result: () => void}}>
