// @flow
import type {DeviceID, Device as ServiceDevice, ProblemSet} from '../constants/types/flow-types'
import type {DeviceType} from '../constants/types/more'
import type {TypedAction} from '../constants/types/flux'

export type Device = {
  type: DeviceType,
  name: string,
  deviceID: DeviceID,
}

// transistions to the next paper key phase
export const toPaperKeyInput = 'unlockFolders:toPaperKeyInput'
export type ToPaperKeyInput = TypedAction<'unlockFolders:toPaperKeyInput', {}, {}>

export const onBackFromPaperKey = 'unlockFolders:onBackFromPaperKey'
export type OnBackFromPaperKey = TypedAction<'unlockFolders:onBackFromPaperKey', {}, {}>

export const checkPaperKey = 'unlockFolders:checkPaperKey'
export type CheckPaperKey = TypedAction<'unlockFolders:checkPaperKey', {success: true}, {error: string}>

export const finish = 'unlockFolders:finish'
export type Finish = TypedAction<'unlockFolders:finish', {}, {}>

export const close = 'unlockFolders:close'
export type Close = TypedAction<'unlockFolders:close', {}, {}>

export const waiting = 'unlockFolders:waiting'
export type Waiting = TypedAction<'unlockFolders:waiting', boolean, {}>

export type RegisterRekeyListenerAction = TypedAction<'notifications:registerRekeyListener', any, any>
export const registerRekeyListener = 'notifications:registerRekeyListener'

export type NewRekeyPopupAction = TypedAction<
  'notifications:newRekeyPopup',
  {
    sessionID: number,
    devices: Array<ServiceDevice>,
    problemSet: ProblemSet,
  },
  void
>
export const newRekeyPopup = 'notifications:newRekeyPopup'

export type Actions =
  | ToPaperKeyInput
  | OnBackFromPaperKey
  | CheckPaperKey
  | Finish
  | Close
  | Waiting
  | RegisterRekeyListenerAction
  | NewRekeyPopupAction

export type State = {
  closed: boolean,
  devices: ?Array<Device>,
  paperkeyError: ?string,
  phase: 'dead' | 'promptOtherDevice' | 'paperKeyInput' | 'success',
  sessionID: ?number,
  started: boolean,
  waiting: boolean,
}
