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
export const close = 'unlock-folders:close'
export const finish = 'unlock-folders:finish'
export const newRekeyPopup = 'unlock-folders:newRekeyPopup'
export const onBackFromPaperKey = 'unlock-folders:onBackFromPaperKey'
export const registerRekeyListener = 'unlock-folders:registerRekeyListener'
export const toPaperKeyInput = 'unlock-folders:toPaperKeyInput'
export const waiting = 'unlock-folders:waiting'

// Action Creators
export const createCheckPaperKey = (payload: {|+success: true|}) => ({error: false, payload, type: checkPaperKey})
export const createCheckPaperKeyError = (payload: {|+error: string|}) => ({error: true, payload, type: checkPaperKey})
export const createClose = () => ({error: false, payload: undefined, type: close})
export const createFinish = () => ({error: false, payload: undefined, type: finish})
export const createNewRekeyPopup = (payload: {|+sessionID: number, +devices: Array<RPCTypes.Service>, +problemSet: RPCTypes.ProblemSet|}) => ({error: false, payload, type: newRekeyPopup})
export const createOnBackFromPaperKey = () => ({error: false, payload: undefined, type: onBackFromPaperKey})
export const createRegisterRekeyListener = () => ({error: false, payload: undefined, type: registerRekeyListener})
export const createToPaperKeyInput = () => ({error: false, payload: undefined, type: toPaperKeyInput})
export const createWaiting = (payload: {|+waiting: boolean|}) => ({error: false, payload, type: waiting})

// Action Payloads
export type CheckPaperKeyPayload = More.ReturnType<typeof createCheckPaperKey>
export type ClosePayload = More.ReturnType<typeof createClose>
export type FinishPayload = More.ReturnType<typeof createFinish>
export type NewRekeyPopupPayload = More.ReturnType<typeof createNewRekeyPopup>
export type OnBackFromPaperKeyPayload = More.ReturnType<typeof createOnBackFromPaperKey>
export type RegisterRekeyListenerPayload = More.ReturnType<typeof createRegisterRekeyListener>
export type ToPaperKeyInputPayload = More.ReturnType<typeof createToPaperKeyInput>
export type WaitingPayload = More.ReturnType<typeof createWaiting>

// All Actions
// prettier-ignore
export type Actions =
  | More.ReturnType<typeof createCheckPaperKey>
  | More.ReturnType<typeof createCheckPaperKeyError>
  | More.ReturnType<typeof createClose>
  | More.ReturnType<typeof createFinish>
  | More.ReturnType<typeof createNewRekeyPopup>
  | More.ReturnType<typeof createOnBackFromPaperKey>
  | More.ReturnType<typeof createRegisterRekeyListener>
  | More.ReturnType<typeof createToPaperKeyInput>
  | More.ReturnType<typeof createWaiting>
  | {type: 'common:resetStore', payload: void}
