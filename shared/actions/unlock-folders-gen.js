// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Constants from '../constants/unlock-folders'

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
type _CheckPaperKeyDonePayloadError = $ReadOnly<{|error: string|}>
type _CheckPaperKeyPayload = $ReadOnly<{|paperKey: string|}>
type _CloseDonePayload = void
type _ClosePopupPayload = void
type _FinishPayload = void
type _NewRekeyPopupPayload = $ReadOnly<{|
  sessionID: number,
  devices: Array<RPCTypes.Device>,
  problemSet: RPCTypes.ProblemSet,
|}>
type _OnBackFromPaperKeyPayload = void
type _OpenPopupPayload = void
type _ToPaperKeyInputPayload = void
type _WaitingPayload = $ReadOnly<{|waiting: boolean|}>

// Action Creators
export const createCheckPaperKey = (payload: _CheckPaperKeyPayload) => ({error: false, payload, type: checkPaperKey})
export const createCheckPaperKeyDone = (payload: _CheckPaperKeyDonePayload) => ({error: false, payload, type: checkPaperKeyDone})
export const createCheckPaperKeyDoneError = (payload: _CheckPaperKeyDonePayloadError) => ({error: true, payload, type: checkPaperKeyDone})
export const createCloseDone = (payload: _CloseDonePayload) => ({error: false, payload, type: closeDone})
export const createClosePopup = (payload: _ClosePopupPayload) => ({error: false, payload, type: closePopup})
export const createFinish = (payload: _FinishPayload) => ({error: false, payload, type: finish})
export const createNewRekeyPopup = (payload: _NewRekeyPopupPayload) => ({error: false, payload, type: newRekeyPopup})
export const createOnBackFromPaperKey = (payload: _OnBackFromPaperKeyPayload) => ({error: false, payload, type: onBackFromPaperKey})
export const createOpenPopup = (payload: _OpenPopupPayload) => ({error: false, payload, type: openPopup})
export const createToPaperKeyInput = (payload: _ToPaperKeyInputPayload) => ({error: false, payload, type: toPaperKeyInput})
export const createWaiting = (payload: _WaitingPayload) => ({error: false, payload, type: waiting})

// Action Payloads
export type CheckPaperKeyDonePayload = $Call<typeof createCheckPaperKeyDone, _CheckPaperKeyDonePayload>
export type CheckPaperKeyDonePayloadError = $Call<typeof createCheckPaperKeyDoneError, _CheckPaperKeyDonePayloadError>
export type CheckPaperKeyPayload = $Call<typeof createCheckPaperKey, _CheckPaperKeyPayload>
export type CloseDonePayload = $Call<typeof createCloseDone, _CloseDonePayload>
export type ClosePopupPayload = $Call<typeof createClosePopup, _ClosePopupPayload>
export type FinishPayload = $Call<typeof createFinish, _FinishPayload>
export type NewRekeyPopupPayload = $Call<typeof createNewRekeyPopup, _NewRekeyPopupPayload>
export type OnBackFromPaperKeyPayload = $Call<typeof createOnBackFromPaperKey, _OnBackFromPaperKeyPayload>
export type OpenPopupPayload = $Call<typeof createOpenPopup, _OpenPopupPayload>
export type ToPaperKeyInputPayload = $Call<typeof createToPaperKeyInput, _ToPaperKeyInputPayload>
export type WaitingPayload = $Call<typeof createWaiting, _WaitingPayload>

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
  | {type: 'common:resetStore', payload: void}
