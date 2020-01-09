// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import * as Types from '../constants/types/crypto'

// Constants
export const resetStore = 'common:resetStore' // not a part of crypto but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'crypto:'
export const clearInput = 'crypto:clearInput'
export const clearRecipients = 'crypto:clearRecipients'
export const onOperationError = 'crypto:onOperationError'
export const onOperationSuccess = 'crypto:onOperationSuccess'
export const resetOperation = 'crypto:resetOperation'
export const saltpackDecrypt = 'crypto:saltpackDecrypt'
export const saltpackEncrypt = 'crypto:saltpackEncrypt'
export const saltpackSign = 'crypto:saltpackSign'
export const saltpackVerify = 'crypto:saltpackVerify'
export const setEncryptOptions = 'crypto:setEncryptOptions'
export const setInput = 'crypto:setInput'
export const setRecipients = 'crypto:setRecipients'

// Payload Types
type _ClearInputPayload = {readonly operation: Types.Operations}
type _ClearRecipientsPayload = {readonly operation: Types.Operations}
type _OnOperationErrorPayload = {
  readonly operation: Types.Operations
  readonly errorType: Types.ErrorTypes
  readonly errorMessage: string
}
type _OnOperationSuccessPayload = {
  readonly operation: Types.Operations
  readonly output: string
  readonly outputType: Types.OutputType
}
type _ResetOperationPayload = {readonly operation: Types.Operations}
type _SaltpackDecryptPayload = {readonly input: string; readonly type: Types.InputTypes}
type _SaltpackEncryptPayload = {
  readonly recipients: Array<string>
  readonly input: string
  readonly type: Types.InputTypes
}
type _SaltpackSignPayload = {readonly input: string; readonly type: Types.InputTypes}
type _SaltpackVerifyPayload = {readonly input: string; readonly type: Types.InputTypes}
type _SetEncryptOptionsPayload = {readonly options: Types.EncryptOptions}
type _SetInputPayload = {
  readonly operation: Types.Operations
  readonly type: Types.InputTypes
  readonly value: string
}
type _SetRecipientsPayload = {readonly operation: Types.Operations; readonly recipients: Array<string>}

// Action Creators
/**
 * Array recipients of operations, provided via TeamBuilding
 */
export const createSetRecipients = (payload: _SetRecipientsPayload): SetRecipientsPayload => ({
  payload,
  type: setRecipients,
})
/**
 * Calls Saltpack RPC
 */
export const createSaltpackDecrypt = (payload: _SaltpackDecryptPayload): SaltpackDecryptPayload => ({
  payload,
  type: saltpackDecrypt,
})
/**
 * Calls Saltpack RPC
 */
export const createSaltpackEncrypt = (payload: _SaltpackEncryptPayload): SaltpackEncryptPayload => ({
  payload,
  type: saltpackEncrypt,
})
/**
 * Calls Saltpack RPC
 */
export const createSaltpackSign = (payload: _SaltpackSignPayload): SaltpackSignPayload => ({
  payload,
  type: saltpackSign,
})
/**
 * Calls Saltpack RPC
 */
export const createSaltpackVerify = (payload: _SaltpackVerifyPayload): SaltpackVerifyPayload => ({
  payload,
  type: saltpackVerify,
})
/**
 * Clear input type and value from the specified operation
 */
export const createClearInput = (payload: _ClearInputPayload): ClearInputPayload => ({
  payload,
  type: clearInput,
})
/**
 * Encrypt operation takes three options { 'includeSelf', 'sign' }
 */
export const createSetEncryptOptions = (payload: _SetEncryptOptionsPayload): SetEncryptOptionsPayload => ({
  payload,
  type: setEncryptOptions,
})
/**
 * On saltpack RPC error response
 */
export const createOnOperationError = (payload: _OnOperationErrorPayload): OnOperationErrorPayload => ({
  payload,
  type: onOperationError,
})
/**
 * On saltpack RPC successful response
 */
export const createOnOperationSuccess = (payload: _OnOperationSuccessPayload): OnOperationSuccessPayload => ({
  payload,
  type: onOperationSuccess,
})
/**
 * Remove all recipients from operation
 */
export const createClearRecipients = (payload: _ClearRecipientsPayload): ClearRecipientsPayload => ({
  payload,
  type: clearRecipients,
})
/**
 * Resets all values in the store for the given operation
 */
export const createResetOperation = (payload: _ResetOperationPayload): ResetOperationPayload => ({
  payload,
  type: resetOperation,
})
/**
 * Set input type (text, file) and value on user input. Either keyboard input or drag-and-drop file
 */
export const createSetInput = (payload: _SetInputPayload): SetInputPayload => ({payload, type: setInput})

// Action Payloads
export type ClearInputPayload = {readonly payload: _ClearInputPayload; readonly type: typeof clearInput}
export type ClearRecipientsPayload = {
  readonly payload: _ClearRecipientsPayload
  readonly type: typeof clearRecipients
}
export type OnOperationErrorPayload = {
  readonly payload: _OnOperationErrorPayload
  readonly type: typeof onOperationError
}
export type OnOperationSuccessPayload = {
  readonly payload: _OnOperationSuccessPayload
  readonly type: typeof onOperationSuccess
}
export type ResetOperationPayload = {
  readonly payload: _ResetOperationPayload
  readonly type: typeof resetOperation
}
export type SaltpackDecryptPayload = {
  readonly payload: _SaltpackDecryptPayload
  readonly type: typeof saltpackDecrypt
}
export type SaltpackEncryptPayload = {
  readonly payload: _SaltpackEncryptPayload
  readonly type: typeof saltpackEncrypt
}
export type SaltpackSignPayload = {readonly payload: _SaltpackSignPayload; readonly type: typeof saltpackSign}
export type SaltpackVerifyPayload = {
  readonly payload: _SaltpackVerifyPayload
  readonly type: typeof saltpackVerify
}
export type SetEncryptOptionsPayload = {
  readonly payload: _SetEncryptOptionsPayload
  readonly type: typeof setEncryptOptions
}
export type SetInputPayload = {readonly payload: _SetInputPayload; readonly type: typeof setInput}
export type SetRecipientsPayload = {
  readonly payload: _SetRecipientsPayload
  readonly type: typeof setRecipients
}

// All Actions
// prettier-ignore
export type Actions =
  | ClearInputPayload
  | ClearRecipientsPayload
  | OnOperationErrorPayload
  | OnOperationSuccessPayload
  | ResetOperationPayload
  | SaltpackDecryptPayload
  | SaltpackEncryptPayload
  | SaltpackSignPayload
  | SaltpackVerifyPayload
  | SetEncryptOptionsPayload
  | SetInputPayload
  | SetRecipientsPayload
  | {type: 'common:resetStore', payload: {}}
