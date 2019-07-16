// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import * as RPCTypes from '../constants/types/rpc-gen'

// Constants
export const resetStore = 'common:resetStore' // not a part of unlock-folders but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'unlock-folders:'
export const checkPaperKey = 'unlock-folders:checkPaperKey'
export const checkPaperKeyDone = 'unlock-folders:checkPaperKeyDone'
export const closeDone = 'unlock-folders:closeDone'
export const closePopup = 'unlock-folders:closePopup'
export const finish = 'unlock-folders:finish'
export const newRekeyPopup = 'unlock-folders:newRekeyPopup'
export const onBackFromPaperKey = 'unlock-folders:onBackFromPaperKey'
export const openPopup = 'unlock-folders:openPopup'
export const toPaperKeyInput = 'unlock-folders:toPaperKeyInput'
export const waiting = 'unlock-folders:waiting'

// Payload Types
type _CheckPaperKeyDonePayload = void
type _CheckPaperKeyDonePayloadError = {readonly error: string}
type _CheckPaperKeyPayload = {readonly paperKey: string}
type _CloseDonePayload = void
type _ClosePopupPayload = void
type _FinishPayload = void
type _NewRekeyPopupPayload = {
  readonly sessionID: number
  readonly devices: Array<RPCTypes.Device>
  readonly problemSet: RPCTypes.ProblemSet
}
type _OnBackFromPaperKeyPayload = void
type _OpenPopupPayload = void
type _ToPaperKeyInputPayload = void
type _WaitingPayload = {readonly waiting: boolean}

// Action Creators
export const createCheckPaperKey = (payload: _CheckPaperKeyPayload): CheckPaperKeyPayload => ({
  payload,
  type: checkPaperKey,
})
export const createCheckPaperKeyDone = (payload: _CheckPaperKeyDonePayload): CheckPaperKeyDonePayload => ({
  payload,
  type: checkPaperKeyDone,
})
export const createCheckPaperKeyDoneError = (
  payload: _CheckPaperKeyDonePayloadError
): CheckPaperKeyDonePayloadError => ({error: true, payload, type: checkPaperKeyDone})
export const createCloseDone = (payload: _CloseDonePayload): CloseDonePayload => ({payload, type: closeDone})
export const createClosePopup = (payload: _ClosePopupPayload): ClosePopupPayload => ({
  payload,
  type: closePopup,
})
export const createFinish = (payload: _FinishPayload): FinishPayload => ({payload, type: finish})
export const createNewRekeyPopup = (payload: _NewRekeyPopupPayload): NewRekeyPopupPayload => ({
  payload,
  type: newRekeyPopup,
})
export const createOnBackFromPaperKey = (payload: _OnBackFromPaperKeyPayload): OnBackFromPaperKeyPayload => ({
  payload,
  type: onBackFromPaperKey,
})
export const createOpenPopup = (payload: _OpenPopupPayload): OpenPopupPayload => ({payload, type: openPopup})
export const createToPaperKeyInput = (payload: _ToPaperKeyInputPayload): ToPaperKeyInputPayload => ({
  payload,
  type: toPaperKeyInput,
})
export const createWaiting = (payload: _WaitingPayload): WaitingPayload => ({payload, type: waiting})

// Action Payloads
export type CheckPaperKeyDonePayload = {
  readonly payload: _CheckPaperKeyDonePayload
  readonly type: typeof checkPaperKeyDone
}
export type CheckPaperKeyDonePayloadError = {
  readonly error: true
  readonly payload: _CheckPaperKeyDonePayloadError
  readonly type: typeof checkPaperKeyDone
}
export type CheckPaperKeyPayload = {
  readonly payload: _CheckPaperKeyPayload
  readonly type: typeof checkPaperKey
}
export type CloseDonePayload = {readonly payload: _CloseDonePayload; readonly type: typeof closeDone}
export type ClosePopupPayload = {readonly payload: _ClosePopupPayload; readonly type: typeof closePopup}
export type FinishPayload = {readonly payload: _FinishPayload; readonly type: typeof finish}
export type NewRekeyPopupPayload = {
  readonly payload: _NewRekeyPopupPayload
  readonly type: typeof newRekeyPopup
}
export type OnBackFromPaperKeyPayload = {
  readonly payload: _OnBackFromPaperKeyPayload
  readonly type: typeof onBackFromPaperKey
}
export type OpenPopupPayload = {readonly payload: _OpenPopupPayload; readonly type: typeof openPopup}
export type ToPaperKeyInputPayload = {
  readonly payload: _ToPaperKeyInputPayload
  readonly type: typeof toPaperKeyInput
}
export type WaitingPayload = {readonly payload: _WaitingPayload; readonly type: typeof waiting}

// All Actions
// prettier-ignore
export type Actions =
  | CheckPaperKeyDonePayload
  | CheckPaperKeyDonePayloadError
  | CheckPaperKeyPayload
  | CloseDonePayload
  | ClosePopupPayload
  | FinishPayload
  | NewRekeyPopupPayload
  | OnBackFromPaperKeyPayload
  | OpenPopupPayload
  | ToPaperKeyInputPayload
  | WaitingPayload
  | {type: 'common:resetStore', payload: {}}
