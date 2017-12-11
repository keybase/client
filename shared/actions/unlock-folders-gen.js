// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/flow-types'
import * as More from '../constants/types/more'
import * as Constants from '../constants/unlock-folders'

// Constants
export const resetStore = 'common:resetStore' // not a part of unlock-folders but is handled by every reducer
export const checkPaperKey = 'unlock-folders:checkPaperKey'
export const checkPaperKeyDone = 'unlock-folders:checkPaperKeyDone'
export const closeDone = 'unlock-folders:closeDone'
export const closePopup = 'unlock-folders:closePopup'
export const finish = 'unlock-folders:finish'
export const newRekeyPopup = 'unlock-folders:newRekeyPopup'
export const onBackFromPaperKey = 'unlock-folders:onBackFromPaperKey'
export const openPopup = 'unlock-folders:openPopup'
export const registerRekeyListener = 'unlock-folders:registerRekeyListener'
export const toPaperKeyInput = 'unlock-folders:toPaperKeyInput'
export const waiting = 'unlock-folders:waiting'

// Action Creators
export const createCheckPaperKey = (payload: {|+paperKey: string|}) => ({error: false, payload, type: checkPaperKey})
export const createCheckPaperKeyDone = () => ({error: false, payload: undefined, type: checkPaperKeyDone})
export const createCheckPaperKeyDoneError = (payload: {|+error: string|}) => ({error: true, payload, type: checkPaperKeyDone})
export const createCloseDone = () => ({error: false, payload: undefined, type: closeDone})
export const createClosePopup = () => ({error: false, payload: undefined, type: closePopup})
export const createFinish = () => ({error: false, payload: undefined, type: finish})
export const createNewRekeyPopup = (payload: {|+sessionID: number, +devices: Array<RPCTypes.Device>, +problemSet: RPCTypes.ProblemSet|}) => ({error: false, payload, type: newRekeyPopup})
export const createOnBackFromPaperKey = () => ({error: false, payload: undefined, type: onBackFromPaperKey})
export const createOpenPopup = () => ({error: false, payload: undefined, type: openPopup})
export const createRegisterRekeyListener = () => ({error: false, payload: undefined, type: registerRekeyListener})
export const createToPaperKeyInput = () => ({error: false, payload: undefined, type: toPaperKeyInput})
export const createWaiting = (payload: {|+waiting: boolean|}) => ({error: false, payload, type: waiting})

// Action Payloads
export type CheckPaperKeyDonePayload = More.ReturnType<typeof createCheckPaperKeyDone>
export type CheckPaperKeyPayload = More.ReturnType<typeof createCheckPaperKey>
export type CloseDonePayload = More.ReturnType<typeof createCloseDone>
export type ClosePopupPayload = More.ReturnType<typeof createClosePopup>
export type FinishPayload = More.ReturnType<typeof createFinish>
export type NewRekeyPopupPayload = More.ReturnType<typeof createNewRekeyPopup>
export type OnBackFromPaperKeyPayload = More.ReturnType<typeof createOnBackFromPaperKey>
export type OpenPopupPayload = More.ReturnType<typeof createOpenPopup>
export type RegisterRekeyListenerPayload = More.ReturnType<typeof createRegisterRekeyListener>
export type ToPaperKeyInputPayload = More.ReturnType<typeof createToPaperKeyInput>
export type WaitingPayload = More.ReturnType<typeof createWaiting>

// All Actions
// prettier-ignore
export type Actions =
  | More.ReturnType<typeof createCheckPaperKey>
  | More.ReturnType<typeof createCheckPaperKeyDone>
  | More.ReturnType<typeof createCheckPaperKeyDoneError>
  | More.ReturnType<typeof createCloseDone>
  | More.ReturnType<typeof createClosePopup>
  | More.ReturnType<typeof createFinish>
  | More.ReturnType<typeof createNewRekeyPopup>
  | More.ReturnType<typeof createOnBackFromPaperKey>
  | More.ReturnType<typeof createOpenPopup>
  | More.ReturnType<typeof createRegisterRekeyListener>
  | More.ReturnType<typeof createToPaperKeyInput>
  | More.ReturnType<typeof createWaiting>
  | {type: 'common:resetStore', payload: void}
