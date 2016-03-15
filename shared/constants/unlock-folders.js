/* @flow */

import HiddenString from '../util/hidden-string'

import type {TypedAction} from '../constants/types/flux'
import type {DeviceID, Device as ServiceDevice} from '../constants/types/flow-types'
import type {DeviceType} from '../constants/types/more'

export type Device = {
  type: DeviceType,
  name: string,
  deviceID: DeviceID
}

export const loadDevices = 'unlockFolders:loadDevices'
export type LoadDevices = TypedAction<'unlockFolders:loadDevices', {devices: Array<ServiceDevice>}, {error: any}>

// transistions to the next paper key phase
export const toPaperKeyInput = 'unlockFolders:toPaperKeyInput'
export type ToPaperKeyInput = TypedAction<'unlockFolders:toPaperKeyInput', {}, {}>

export const checkPaperKey = 'unlockFolders:checkPaperKey'
export type CheckPaperKey = TypedAction<'unlockFolders:checkPaperKey', {success: true}, {error: HiddenString}>

export const finish = 'unlockFolders:finish'
export type Finish = TypedAction<'unlockFolders:finish', {}, {}>

export type UnlockFolderActions = LoadDevices | ToPaperKeyInput | CheckPaperKey | Finish

