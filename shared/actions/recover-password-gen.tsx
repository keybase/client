// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import * as Types from '../constants/types/provision'

// Constants
export const resetStore = 'common:resetStore' // not a part of recover-password but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'recover-password:'
export const abortDeviceSelect = 'recover-password:abortDeviceSelect'
export const abortPaperKey = 'recover-password:abortPaperKey'
export const displayError = 'recover-password:displayError'
export const displayPaperKeyError = 'recover-password:displayPaperKeyError'
export const showDeviceListPage = 'recover-password:showDeviceListPage'
export const showExplainDevice = 'recover-password:showExplainDevice'
export const showPaperKey = 'recover-password:showPaperKey'
export const startRecoverPassword = 'recover-password:startRecoverPassword'
export const submitDeviceSelect = 'recover-password:submitDeviceSelect'
export const submitPaperKey = 'recover-password:submitPaperKey'
export const submitResetPrompt = 'recover-password:submitResetPrompt'

// Payload Types
type _AbortDeviceSelectPayload = void
type _AbortPaperKeyPayload = void
type _DisplayErrorPayload = {readonly error: string}
type _DisplayPaperKeyErrorPayload = {readonly error: string}
type _ShowDeviceListPagePayload = {readonly devices: Array<Types.Device>}
type _ShowExplainDevicePayload = {readonly type: 'desktop' | 'mobile'; readonly name: string}
type _ShowPaperKeyPayload = void
type _StartRecoverPasswordPayload = {readonly username: string}
type _SubmitDeviceSelectPayload = {readonly id: string}
type _SubmitPaperKeyPayload = {readonly paperKey: string}
type _SubmitResetPromptPayload = {readonly action: boolean}

// Action Creators
export const createAbortDeviceSelect = (payload: _AbortDeviceSelectPayload): AbortDeviceSelectPayload => ({
  payload,
  type: abortDeviceSelect,
})
export const createAbortPaperKey = (payload: _AbortPaperKeyPayload): AbortPaperKeyPayload => ({
  payload,
  type: abortPaperKey,
})
export const createDisplayError = (payload: _DisplayErrorPayload): DisplayErrorPayload => ({
  payload,
  type: displayError,
})
export const createDisplayPaperKeyError = (
  payload: _DisplayPaperKeyErrorPayload
): DisplayPaperKeyErrorPayload => ({payload, type: displayPaperKeyError})
export const createShowDeviceListPage = (payload: _ShowDeviceListPagePayload): ShowDeviceListPagePayload => ({
  payload,
  type: showDeviceListPage,
})
export const createShowExplainDevice = (payload: _ShowExplainDevicePayload): ShowExplainDevicePayload => ({
  payload,
  type: showExplainDevice,
})
export const createShowPaperKey = (payload: _ShowPaperKeyPayload): ShowPaperKeyPayload => ({
  payload,
  type: showPaperKey,
})
export const createStartRecoverPassword = (
  payload: _StartRecoverPasswordPayload
): StartRecoverPasswordPayload => ({payload, type: startRecoverPassword})
export const createSubmitDeviceSelect = (payload: _SubmitDeviceSelectPayload): SubmitDeviceSelectPayload => ({
  payload,
  type: submitDeviceSelect,
})
export const createSubmitPaperKey = (payload: _SubmitPaperKeyPayload): SubmitPaperKeyPayload => ({
  payload,
  type: submitPaperKey,
})
export const createSubmitResetPrompt = (payload: _SubmitResetPromptPayload): SubmitResetPromptPayload => ({
  payload,
  type: submitResetPrompt,
})

// Action Payloads
export type AbortDeviceSelectPayload = {
  readonly payload: _AbortDeviceSelectPayload
  readonly type: typeof abortDeviceSelect
}
export type AbortPaperKeyPayload = {
  readonly payload: _AbortPaperKeyPayload
  readonly type: typeof abortPaperKey
}
export type DisplayErrorPayload = {readonly payload: _DisplayErrorPayload; readonly type: typeof displayError}
export type DisplayPaperKeyErrorPayload = {
  readonly payload: _DisplayPaperKeyErrorPayload
  readonly type: typeof displayPaperKeyError
}
export type ShowDeviceListPagePayload = {
  readonly payload: _ShowDeviceListPagePayload
  readonly type: typeof showDeviceListPage
}
export type ShowExplainDevicePayload = {
  readonly payload: _ShowExplainDevicePayload
  readonly type: typeof showExplainDevice
}
export type ShowPaperKeyPayload = {readonly payload: _ShowPaperKeyPayload; readonly type: typeof showPaperKey}
export type StartRecoverPasswordPayload = {
  readonly payload: _StartRecoverPasswordPayload
  readonly type: typeof startRecoverPassword
}
export type SubmitDeviceSelectPayload = {
  readonly payload: _SubmitDeviceSelectPayload
  readonly type: typeof submitDeviceSelect
}
export type SubmitPaperKeyPayload = {
  readonly payload: _SubmitPaperKeyPayload
  readonly type: typeof submitPaperKey
}
export type SubmitResetPromptPayload = {
  readonly payload: _SubmitResetPromptPayload
  readonly type: typeof submitResetPrompt
}

// All Actions
// prettier-ignore
export type Actions =
  | AbortDeviceSelectPayload
  | AbortPaperKeyPayload
  | DisplayErrorPayload
  | DisplayPaperKeyErrorPayload
  | ShowDeviceListPagePayload
  | ShowExplainDevicePayload
  | ShowPaperKeyPayload
  | StartRecoverPasswordPayload
  | SubmitDeviceSelectPayload
  | SubmitPaperKeyPayload
  | SubmitResetPromptPayload
  | {type: 'common:resetStore', payload: {}}
