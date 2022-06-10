// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
import type * as RPCTypes from '../constants/types/rpc-gen'

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

// Action Creators
export const createCheckPaperKey = (payload: {readonly paperKey: string}) => ({
  payload,
  type: checkPaperKey as typeof checkPaperKey,
})
export const createCheckPaperKeyDone = (payload: {readonly error?: string} = {}) => ({
  payload,
  type: checkPaperKeyDone as typeof checkPaperKeyDone,
})
export const createCloseDone = (payload?: undefined) => ({payload, type: closeDone as typeof closeDone})
export const createClosePopup = (payload?: undefined) => ({payload, type: closePopup as typeof closePopup})
export const createFinish = (payload?: undefined) => ({payload, type: finish as typeof finish})
export const createNewRekeyPopup = (payload: {
  readonly sessionID: number
  readonly devices: Array<RPCTypes.Device>
  readonly problemSet: RPCTypes.ProblemSet
}) => ({payload, type: newRekeyPopup as typeof newRekeyPopup})
export const createOnBackFromPaperKey = (payload?: undefined) => ({
  payload,
  type: onBackFromPaperKey as typeof onBackFromPaperKey,
})
export const createOpenPopup = (payload?: undefined) => ({payload, type: openPopup as typeof openPopup})
export const createToPaperKeyInput = (payload?: undefined) => ({
  payload,
  type: toPaperKeyInput as typeof toPaperKeyInput,
})

// Action Payloads
export type CheckPaperKeyDonePayload = ReturnType<typeof createCheckPaperKeyDone>
export type CheckPaperKeyPayload = ReturnType<typeof createCheckPaperKey>
export type CloseDonePayload = ReturnType<typeof createCloseDone>
export type ClosePopupPayload = ReturnType<typeof createClosePopup>
export type FinishPayload = ReturnType<typeof createFinish>
export type NewRekeyPopupPayload = ReturnType<typeof createNewRekeyPopup>
export type OnBackFromPaperKeyPayload = ReturnType<typeof createOnBackFromPaperKey>
export type OpenPopupPayload = ReturnType<typeof createOpenPopup>
export type ToPaperKeyInputPayload = ReturnType<typeof createToPaperKeyInput>

// All Actions
// prettier-ignore
export type Actions =
  | CheckPaperKeyDonePayload
  | CheckPaperKeyPayload
  | CloseDonePayload
  | ClosePopupPayload
  | FinishPayload
  | NewRekeyPopupPayload
  | OnBackFromPaperKeyPayload
  | OpenPopupPayload
  | ToPaperKeyInputPayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
