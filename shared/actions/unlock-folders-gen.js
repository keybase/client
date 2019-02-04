// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define,import/no-duplicates */

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
type _NewRekeyPopupPayload = $ReadOnly<{|sessionID: number, devices: Array<RPCTypes.Device>, problemSet: RPCTypes.ProblemSet|}>
type _OnBackFromPaperKeyPayload = void
type _OpenPopupPayload = void
type _ToPaperKeyInputPayload = void
type _WaitingPayload = $ReadOnly<{|waiting: boolean|}>

// Action Creators
export const createCheckPaperKey = (payload: _CheckPaperKeyPayload) => ({payload, type: checkPaperKey})
export const createCheckPaperKeyDone = (payload: _CheckPaperKeyDonePayload) => ({payload, type: checkPaperKeyDone})
export const createCheckPaperKeyDoneError = (payload: _CheckPaperKeyDonePayloadError) => ({error: true, payload, type: checkPaperKeyDone})
export const createCloseDone = (payload: _CloseDonePayload) => ({payload, type: closeDone})
export const createClosePopup = (payload: _ClosePopupPayload) => ({payload, type: closePopup})
export const createFinish = (payload: _FinishPayload) => ({payload, type: finish})
export const createNewRekeyPopup = (payload: _NewRekeyPopupPayload) => ({payload, type: newRekeyPopup})
export const createOnBackFromPaperKey = (payload: _OnBackFromPaperKeyPayload) => ({payload, type: onBackFromPaperKey})
export const createOpenPopup = (payload: _OpenPopupPayload) => ({payload, type: openPopup})
export const createToPaperKeyInput = (payload: _ToPaperKeyInputPayload) => ({payload, type: toPaperKeyInput})
export const createWaiting = (payload: _WaitingPayload) => ({payload, type: waiting})

// Action Payloads
export type CheckPaperKeyDonePayload = {|+payload: _CheckPaperKeyDonePayload, +type: 'unlock-folders:checkPaperKeyDone'|}
export type CheckPaperKeyDonePayloadError = {|+error: true, +payload: _CheckPaperKeyDonePayloadError, +type: 'unlock-folders:checkPaperKeyDone'|}
export type CheckPaperKeyPayload = {|+payload: _CheckPaperKeyPayload, +type: 'unlock-folders:checkPaperKey'|}
export type CloseDonePayload = {|+payload: _CloseDonePayload, +type: 'unlock-folders:closeDone'|}
export type ClosePopupPayload = {|+payload: _ClosePopupPayload, +type: 'unlock-folders:closePopup'|}
export type FinishPayload = {|+payload: _FinishPayload, +type: 'unlock-folders:finish'|}
export type NewRekeyPopupPayload = {|+payload: _NewRekeyPopupPayload, +type: 'unlock-folders:newRekeyPopup'|}
export type OnBackFromPaperKeyPayload = {|+payload: _OnBackFromPaperKeyPayload, +type: 'unlock-folders:onBackFromPaperKey'|}
export type OpenPopupPayload = {|+payload: _OpenPopupPayload, +type: 'unlock-folders:openPopup'|}
export type ToPaperKeyInputPayload = {|+payload: _ToPaperKeyInputPayload, +type: 'unlock-folders:toPaperKeyInput'|}
export type WaitingPayload = {|+payload: _WaitingPayload, +type: 'unlock-folders:waiting'|}

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
  | {type: 'common:resetStore', payload: null}
