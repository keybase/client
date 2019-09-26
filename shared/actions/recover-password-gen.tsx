// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/provision'

// Constants
export const resetStore = 'common:resetStore' // not a part of recover-password but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'recover-password:'
export const abortDeviceSelect = 'recover-password:abortDeviceSelect'
export const abortPaperKey = 'recover-password:abortPaperKey'
export const displayDeviceSelect = 'recover-password:displayDeviceSelect'
export const displayError = 'recover-password:displayError'
export const restartRecovery = 'recover-password:restartRecovery'
export const setPaperKeyError = 'recover-password:setPaperKeyError'
export const showExplainDevice = 'recover-password:showExplainDevice'
export const startRecoverPassword = 'recover-password:startRecoverPassword'
export const submitDeviceSelect = 'recover-password:submitDeviceSelect'
export const submitPaperKey = 'recover-password:submitPaperKey'

// Payload Types
type _AbortDeviceSelectPayload = void
type _AbortPaperKeyPayload = void
type _DisplayDeviceSelectPayload = {readonly devices: Array<Types.Device>}
type _DisplayErrorPayload = {readonly error: string}
type _RestartRecoveryPayload = void
type _SetPaperKeyErrorPayload = {readonly error: string}
type _ShowExplainDevicePayload = {readonly type: RPCTypes.DeviceType; readonly name: string}
type _StartRecoverPasswordPayload = {readonly username: string}
type _SubmitDeviceSelectPayload = {readonly id: string}
type _SubmitPaperKeyPayload = {readonly paperKey: string}

// Action Creators
export const createAbortDeviceSelect = (payload: _AbortDeviceSelectPayload): AbortDeviceSelectPayload => ({
  payload,
  type: abortDeviceSelect,
})
export const createAbortPaperKey = (payload: _AbortPaperKeyPayload): AbortPaperKeyPayload => ({
  payload,
  type: abortPaperKey,
})
export const createDisplayDeviceSelect = (
  payload: _DisplayDeviceSelectPayload
): DisplayDeviceSelectPayload => ({payload, type: displayDeviceSelect})
export const createDisplayError = (payload: _DisplayErrorPayload): DisplayErrorPayload => ({
  payload,
  type: displayError,
})
export const createRestartRecovery = (payload: _RestartRecoveryPayload): RestartRecoveryPayload => ({
  payload,
  type: restartRecovery,
})
export const createSetPaperKeyError = (payload: _SetPaperKeyErrorPayload): SetPaperKeyErrorPayload => ({
  payload,
  type: setPaperKeyError,
})
export const createShowExplainDevice = (payload: _ShowExplainDevicePayload): ShowExplainDevicePayload => ({
  payload,
  type: showExplainDevice,
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

// Action Payloads
export type AbortDeviceSelectPayload = {
  readonly payload: _AbortDeviceSelectPayload
  readonly type: typeof abortDeviceSelect
}
export type AbortPaperKeyPayload = {
  readonly payload: _AbortPaperKeyPayload
  readonly type: typeof abortPaperKey
}
export type DisplayDeviceSelectPayload = {
  readonly payload: _DisplayDeviceSelectPayload
  readonly type: typeof displayDeviceSelect
}
export type DisplayErrorPayload = {readonly payload: _DisplayErrorPayload; readonly type: typeof displayError}
export type RestartRecoveryPayload = {
  readonly payload: _RestartRecoveryPayload
  readonly type: typeof restartRecovery
}
export type SetPaperKeyErrorPayload = {
  readonly payload: _SetPaperKeyErrorPayload
  readonly type: typeof setPaperKeyError
}
export type ShowExplainDevicePayload = {
  readonly payload: _ShowExplainDevicePayload
  readonly type: typeof showExplainDevice
}
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

// All Actions
// prettier-ignore
export type Actions =
  | AbortDeviceSelectPayload
  | AbortPaperKeyPayload
  | DisplayDeviceSelectPayload
  | DisplayErrorPayload
  | RestartRecoveryPayload
  | SetPaperKeyErrorPayload
  | ShowExplainDevicePayload
  | StartRecoverPasswordPayload
  | SubmitDeviceSelectPayload
  | SubmitPaperKeyPayload
  | {type: 'common:resetStore', payload: {}}
