/* @flow */

import HiddenString from '../util/hidden-string'
import type {TypedAction} from '../constants/types/flux'
import type {DeviceID} from '../constants/types/flow-types'

export type Device = {
  type: 'desktop' | 'mobile',
  name: string,
  deviceID: DeviceID
}

export const loadDevices = 'unlockFolders:loadDevices'
export type LoadDevices = TypedAction<'unlockFolders:loadDevices', {devices: Array<Device>}, {}>

// transistions to the next paper key phase
export const toPaperKeyInput = 'unlockFolders:toPaperKeyInput'
export type ToPaperKeyInput = TypedAction<'unlockFolders:toPaperKeyInput', {}, {}>

// TODO: not sure if we even need this, we might be able to do it all without having to store the paperkey
export const storePaperKey = 'unlockFolders:toPaperKeyInput'
export type StorePaperKey = TypedAction<'unlockFolders:toPaperKeyInput', {paperKey: HiddenString}, {}>

export const checkPaperKey = 'unlockFolders:checkPaperKey'
export type CheckPaperKey = TypedAction<'unlockFolders:checkPaperKey', {success: true}, {error: string}>

export const finish = 'unlockFolders:finish'
export type Finish = TypedAction<'unlockFolders:finish', {}, {}>

export const close = 'unlockFolders:close'
export type Close = TypedAction<'unlockFolders:close', {}, {}>

export type UnlockFolderActions = LoadDevices | ToPaperKeyInput | StorePaperKey | CheckPaperKey | Finish | Close

