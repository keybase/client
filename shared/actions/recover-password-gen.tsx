// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
import type * as RPCTypes from '../constants/types/rpc-gen'
import type * as Types from '../constants/types/provision'
import type HiddenString from '../util/hidden-string'

// Constants
export const resetStore = 'common:resetStore' // not a part of recover-password but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'recover-password:'
export const abortDeviceSelect = 'recover-password:abortDeviceSelect'
export const abortPaperKey = 'recover-password:abortPaperKey'
export const completeResetPassword = 'recover-password:completeResetPassword'
export const displayDeviceSelect = 'recover-password:displayDeviceSelect'
export const displayError = 'recover-password:displayError'
export const promptResetPassword = 'recover-password:promptResetPassword'
export const resetResetPasswordState = 'recover-password:resetResetPasswordState'
export const restartRecovery = 'recover-password:restartRecovery'
export const setPaperKeyError = 'recover-password:setPaperKeyError'
export const setPasswordError = 'recover-password:setPasswordError'
export const showExplainDevice = 'recover-password:showExplainDevice'
export const startRecoverPassword = 'recover-password:startRecoverPassword'
export const submitDeviceSelect = 'recover-password:submitDeviceSelect'
export const submitPaperKey = 'recover-password:submitPaperKey'
export const submitPassword = 'recover-password:submitPassword'
export const submitResetPassword = 'recover-password:submitResetPassword'
export const submitResetPrompt = 'recover-password:submitResetPrompt'

// Action Creators
export const createAbortDeviceSelect = (payload?: undefined) => ({
  payload,
  type: abortDeviceSelect as typeof abortDeviceSelect,
})
export const createAbortPaperKey = (payload?: undefined) => ({
  payload,
  type: abortPaperKey as typeof abortPaperKey,
})
export const createCompleteResetPassword = (payload?: undefined) => ({
  payload,
  type: completeResetPassword as typeof completeResetPassword,
})
export const createDisplayDeviceSelect = (payload: {
  readonly devices: Array<Types.Device>
  readonly replaceRoute?: boolean
}) => ({payload, type: displayDeviceSelect as typeof displayDeviceSelect})
export const createDisplayError = (payload: {readonly error: HiddenString}) => ({
  payload,
  type: displayError as typeof displayError,
})
export const createPromptResetPassword = (payload?: undefined) => ({
  payload,
  type: promptResetPassword as typeof promptResetPassword,
})
export const createResetResetPasswordState = (payload?: undefined) => ({
  payload,
  type: resetResetPasswordState as typeof resetResetPasswordState,
})
export const createRestartRecovery = (payload?: undefined) => ({
  payload,
  type: restartRecovery as typeof restartRecovery,
})
export const createSetPaperKeyError = (payload: {readonly error: HiddenString}) => ({
  payload,
  type: setPaperKeyError as typeof setPaperKeyError,
})
export const createSetPasswordError = (payload: {readonly error: HiddenString}) => ({
  payload,
  type: setPasswordError as typeof setPasswordError,
})
export const createShowExplainDevice = (payload: {
  readonly type: RPCTypes.DeviceType
  readonly name: string
}) => ({payload, type: showExplainDevice as typeof showExplainDevice})
export const createStartRecoverPassword = (payload: {
  readonly username: string
  readonly abortProvisioning?: boolean
  readonly replaceRoute?: boolean
}) => ({payload, type: startRecoverPassword as typeof startRecoverPassword})
export const createSubmitDeviceSelect = (payload: {readonly id: string}) => ({
  payload,
  type: submitDeviceSelect as typeof submitDeviceSelect,
})
export const createSubmitPaperKey = (payload: {readonly paperKey: HiddenString}) => ({
  payload,
  type: submitPaperKey as typeof submitPaperKey,
})
export const createSubmitPassword = (payload: {readonly password: HiddenString}) => ({
  payload,
  type: submitPassword as typeof submitPassword,
})
export const createSubmitResetPassword = (payload: {readonly action: RPCTypes.ResetPromptResponse}) => ({
  payload,
  type: submitResetPassword as typeof submitResetPassword,
})
export const createSubmitResetPrompt = (payload: {readonly action: RPCTypes.ResetPromptResponse}) => ({
  payload,
  type: submitResetPrompt as typeof submitResetPrompt,
})

// Action Payloads
export type AbortDeviceSelectPayload = ReturnType<typeof createAbortDeviceSelect>
export type AbortPaperKeyPayload = ReturnType<typeof createAbortPaperKey>
export type CompleteResetPasswordPayload = ReturnType<typeof createCompleteResetPassword>
export type DisplayDeviceSelectPayload = ReturnType<typeof createDisplayDeviceSelect>
export type DisplayErrorPayload = ReturnType<typeof createDisplayError>
export type PromptResetPasswordPayload = ReturnType<typeof createPromptResetPassword>
export type ResetResetPasswordStatePayload = ReturnType<typeof createResetResetPasswordState>
export type RestartRecoveryPayload = ReturnType<typeof createRestartRecovery>
export type SetPaperKeyErrorPayload = ReturnType<typeof createSetPaperKeyError>
export type SetPasswordErrorPayload = ReturnType<typeof createSetPasswordError>
export type ShowExplainDevicePayload = ReturnType<typeof createShowExplainDevice>
export type StartRecoverPasswordPayload = ReturnType<typeof createStartRecoverPassword>
export type SubmitDeviceSelectPayload = ReturnType<typeof createSubmitDeviceSelect>
export type SubmitPaperKeyPayload = ReturnType<typeof createSubmitPaperKey>
export type SubmitPasswordPayload = ReturnType<typeof createSubmitPassword>
export type SubmitResetPasswordPayload = ReturnType<typeof createSubmitResetPassword>
export type SubmitResetPromptPayload = ReturnType<typeof createSubmitResetPrompt>

// All Actions
// prettier-ignore
export type Actions =
  | AbortDeviceSelectPayload
  | AbortPaperKeyPayload
  | CompleteResetPasswordPayload
  | DisplayDeviceSelectPayload
  | DisplayErrorPayload
  | PromptResetPasswordPayload
  | ResetResetPasswordStatePayload
  | RestartRecoveryPayload
  | SetPaperKeyErrorPayload
  | SetPasswordErrorPayload
  | ShowExplainDevicePayload
  | StartRecoverPasswordPayload
  | SubmitDeviceSelectPayload
  | SubmitPaperKeyPayload
  | SubmitPasswordPayload
  | SubmitResetPasswordPayload
  | SubmitResetPromptPayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
