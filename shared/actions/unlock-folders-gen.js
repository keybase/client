// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/flow-types'
import * as More from '../constants/types/more'
import * as Types from '../constants/types/unlock-folders'

// Constants
export const resetStore = 'common:resetStore' // not a part of unlock-folders but is handled by every reducer
export const checkPaperKeyDone = 'unlock-folders:checkPaperKeyDone'
export const closeDone = 'unlock-folders:closeDone'
export const finish = 'unlock-folders:finish'
export const newRekeyPopup = 'unlock-folders:newRekeyPopup'
export const onBackFromPaperKey = 'unlock-folders:onBackFromPaperKey'
export const registerRekeyListener = 'unlock-folders:registerRekeyListener'
export const toPaperKeyInput = 'unlock-folders:toPaperKeyInput'
export const waiting = 'unlock-folders:waiting'

// Action Creators
export const createCheckPaperKeyDone = () => ({error: false, payload: undefined, type: checkPaperKeyDone})
export const createCheckPaperKeyDoneError = (payload: {|+error: string|}) => ({error: true, payload, type: checkPaperKeyDone})
export const createCloseDone = () => ({error: false, payload: undefined, type: closeDone})
export const createFinish = () => ({error: false, payload: undefined, type: finish})
export const createNewRekeyPopup = (payload: {|+sessionID: number, +devices: Array<RPCTypes.Device>, +problemSet: RPCTypes.ProblemSet|}) => ({error: false, payload, type: newRekeyPopup})
export const createOnBackFromPaperKey = () => ({error: false, payload: undefined, type: onBackFromPaperKey})
export const createRegisterRekeyListener = () => ({error: false, payload: undefined, type: registerRekeyListener})
export const createToPaperKeyInput = () => ({error: false, payload: undefined, type: toPaperKeyInput})
export const createWaiting = (payload: {|+waiting: boolean|}) => ({error: false, payload, type: waiting})

// Action Payloads
export type CheckPaperKeyDonePayload = More.ReturnType<typeof createCheckPaperKeyDone>
export type CheckPaperKeyDoneErrorPayload = More.ReturnType<typeof createCheckPaperKeyDoneError>
export type CloseDonePayload = More.ReturnType<typeof createCloseDone>
export type FinishPayload = More.ReturnType<typeof createFinish>
export type NewRekeyPopupPayload = More.ReturnType<typeof createNewRekeyPopup>
export type OnBackFromPaperKeyPayload = More.ReturnType<typeof createOnBackFromPaperKey>
export type RegisterRekeyListenerPayload = More.ReturnType<typeof createRegisterRekeyListener>
export type ToPaperKeyInputPayload = More.ReturnType<typeof createToPaperKeyInput>
export type WaitingPayload = More.ReturnType<typeof createWaiting>

// Reducer type
// prettier-ignore
export type ReducerMap = {|'common:resetStore': (state: Types.State, action: {type: 'common:resetStore', payload: void}) => Types.State, 'unlock-folders:checkPaperKeyDone': (state: Types.State, action: CheckPaperKeyDonePayload|CheckPaperKeyDoneErrorPayload) => Types.State, 'unlock-folders:closeDone': (state: Types.State, action: CloseDonePayload) => Types.State, 'unlock-folders:finish': (state: Types.State, action: FinishPayload) => Types.State, 'unlock-folders:newRekeyPopup': (state: Types.State, action: NewRekeyPopupPayload) => Types.State, 'unlock-folders:onBackFromPaperKey': (state: Types.State, action: OnBackFromPaperKeyPayload) => Types.State, 'unlock-folders:registerRekeyListener': (state: Types.State, action: RegisterRekeyListenerPayload) => Types.State, 'unlock-folders:toPaperKeyInput': (state: Types.State, action: ToPaperKeyInputPayload) => Types.State, 'unlock-folders:waiting': (state: Types.State, action: WaitingPayload) => Types.State|}

// All Actions
// prettier-ignore
export type Actions = CheckPaperKeyDonePayload
 | CheckPaperKeyDoneErrorPayload | CloseDonePayload | FinishPayload | NewRekeyPopupPayload | OnBackFromPaperKeyPayload | RegisterRekeyListenerPayload | ToPaperKeyInputPayload | WaitingPayload | {type: 'common:resetStore', payload: void}
