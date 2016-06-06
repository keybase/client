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

export const onBackFromPaperKey = 'unlockFolders:onBackFromPaperKey'
export type OnBackFromPaperKey = TypedAction<'unlockFolders:onBackFromPaperKey', {}, {}>

export const checkPaperKey = 'unlockFolders:checkPaperKey'
export type CheckPaperKey = TypedAction<'unlockFolders:checkPaperKey', {success: true}, {error: HiddenString}>

export const finish = 'unlockFolders:finish'
export type Finish = TypedAction<'unlockFolders:finish', {}, {}>

export const close = 'unlockFolders:close'
export type Close = TypedAction<'unlockFolders:close', {}, {}>

export const waiting = 'unlockFolders:waiting'
export type Waiting = TypedAction<'unlockFolders:waiting', boolean, {}>

export type RegisterRekeyListenerAction = TypedAction<'notifications:registerRekeyListener', any, any>
export const registerRekeyListener = 'notifications:registerRekeyListener'

export type NewRekeyPopupAction = TypedAction<'notifications:newRekeyPopup', any, void>
export const newRekeyPopup = 'notifications:newRekeyPopup'

export type UnlockFolderActions = LoadDevices | ToPaperKeyInput | OnBackFromPaperKey | CheckPaperKey | Finish
| Close | Waiting | RegisterRekeyListenerAction |NewRekeyPopupAction
