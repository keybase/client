// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import * as Types from '../constants/types/crypto'
import HiddenString from '../util/hidden-string'

// Constants
export const resetStore = 'common:resetStore' // not a part of crypto but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'crypto:'
export const clearInput = 'crypto:clearInput'
export const clearRecipients = 'crypto:clearRecipients'
export const downloadEncryptedText = 'crypto:downloadEncryptedText'
export const downloadSignedText = 'crypto:downloadSignedText'
export const onOperationError = 'crypto:onOperationError'
export const onOperationSuccess = 'crypto:onOperationSuccess'
export const onSaltpackOpenFile = 'crypto:onSaltpackOpenFile'
export const resetOperation = 'crypto:resetOperation'
export const runFileOperation = 'crypto:runFileOperation'
export const runTextOperation = 'crypto:runTextOperation'
export const saltpackDecrypt = 'crypto:saltpackDecrypt'
export const saltpackDone = 'crypto:saltpackDone'
export const saltpackEncrypt = 'crypto:saltpackEncrypt'
export const saltpackProgress = 'crypto:saltpackProgress'
export const saltpackSign = 'crypto:saltpackSign'
export const saltpackStart = 'crypto:saltpackStart'
export const saltpackVerify = 'crypto:saltpackVerify'
export const setEncryptOptions = 'crypto:setEncryptOptions'
export const setInput = 'crypto:setInput'
export const setInputThrottled = 'crypto:setInputThrottled'
export const setRecipients = 'crypto:setRecipients'

// Payload Types
type _ClearInputPayload = {readonly operation: Types.Operations}
type _ClearRecipientsPayload = {readonly operation: Types.Operations}
type _DownloadEncryptedTextPayload = void
type _DownloadSignedTextPayload = void
type _OnOperationErrorPayload = {readonly operation: Types.Operations; readonly errorMessage: HiddenString}
type _OnOperationSuccessPayload = {
  readonly input: any
  readonly operation: Types.Operations
  readonly output: HiddenString
  readonly outputSenderUsername?: HiddenString
  readonly outputSenderFullname?: HiddenString
  readonly outputSigned: boolean
  readonly outputType: Types.OutputType
  readonly warning?: boolean
  readonly warningMessage?: HiddenString
}
type _OnSaltpackOpenFilePayload = {readonly operation: Types.Operations; readonly path: HiddenString}
type _ResetOperationPayload = {readonly operation: Types.Operations}
type _RunFileOperationPayload = {readonly operation: Types.Operations; readonly destinationDir: HiddenString}
type _RunTextOperationPayload = {readonly operation: Types.Operations}
type _SaltpackDecryptPayload = {
  readonly input: HiddenString
  readonly type: Types.InputTypes
  readonly destinationDir?: HiddenString
}
type _SaltpackDonePayload = {readonly filename: HiddenString; readonly operation: Types.Operations}
type _SaltpackEncryptPayload = {
  readonly input: HiddenString
  readonly options: Types.EncryptOptions
  readonly recipients: Array<string>
  readonly type: Types.InputTypes
  readonly destinationDir?: HiddenString
}
type _SaltpackProgressPayload = {
  readonly bytesComplete: number
  readonly bytesTotal: number
  readonly filename: HiddenString
  readonly operation: Types.Operations
}
type _SaltpackSignPayload = {
  readonly input: HiddenString
  readonly type: Types.InputTypes
  readonly destinationDir?: HiddenString
}
type _SaltpackStartPayload = {readonly filename: HiddenString; readonly operation: Types.Operations}
type _SaltpackVerifyPayload = {
  readonly input: HiddenString
  readonly type: Types.InputTypes
  readonly destinationDir?: HiddenString
}
type _SetEncryptOptionsPayload = {readonly options: Types.EncryptOptions; readonly hideIncludeSelf?: boolean}
type _SetInputPayload = {
  readonly operation: Types.Operations
  readonly type: Types.InputTypes
  readonly value: HiddenString
}
type _SetInputThrottledPayload = {
  readonly operation: Types.Operations
  readonly type: Types.InputTypes
  readonly value: HiddenString
}
type _SetRecipientsPayload = {
  readonly operation: Types.Operations
  readonly recipients: Array<string>
  readonly hasSBS: boolean
}

// Action Creators
/**
 * Array recipients of operations, provided via TeamBuilding.
 * Includes flag if any users are not on Keybase yet (SBS) to force includeSelf in EncryptOptions
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
 * Download the encrypted output to a text file
 */
export const createDownloadEncryptedText = (
  payload: _DownloadEncryptedTextPayload
): DownloadEncryptedTextPayload => ({payload, type: downloadEncryptedText})
/**
 * Download the signed output to a text file
 */
export const createDownloadSignedText = (payload: _DownloadSignedTextPayload): DownloadSignedTextPayload => ({
  payload,
  type: downloadSignedText,
})
/**
 * On saltpack RPC error response
 */
export const createOnOperationError = (payload: _OnOperationErrorPayload): OnOperationErrorPayload => ({
  payload,
  type: onOperationError,
})
/**
 * On saltpack RPC successful response. input is the operation that started it
 */
export const createOnOperationSuccess = (payload: _OnOperationSuccessPayload): OnOperationSuccessPayload => ({
  payload,
  type: onOperationSuccess,
})
/**
 * Progress logging
 */
export const createSaltpackDone = (payload: _SaltpackDonePayload): SaltpackDonePayload => ({
  payload,
  type: saltpackDone,
})
/**
 * Progress logging
 */
export const createSaltpackProgress = (payload: _SaltpackProgressPayload): SaltpackProgressPayload => ({
  payload,
  type: saltpackProgress,
})
/**
 * Progress logging
 */
export const createSaltpackStart = (payload: _SaltpackStartPayload): SaltpackStartPayload => ({
  payload,
  type: saltpackStart,
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
 * Same as setInput but throttled
 */
export const createSetInputThrottled = (payload: _SetInputThrottledPayload): SetInputThrottledPayload => ({
  payload,
  type: setInputThrottled,
})
/**
 * Set input type (text, file) and value on user input. Either keyboard input or drag-and-drop file
 */
export const createSetInput = (payload: _SetInputPayload): SetInputPayload => ({payload, type: setInput})
/**
 * Sets options for encrypt operations.
 * Also takes `hideIncludeSelf` to disable includeSelf when user includes themselves as a recipient
 */
export const createSetEncryptOptions = (payload: _SetEncryptOptionsPayload): SetEncryptOptionsPayload => ({
  payload,
  type: setEncryptOptions,
})
/**
 * Used on mobile to split input/output steps
 */
export const createRunTextOperation = (payload: _RunTextOperationPayload): RunTextOperationPayload => ({
  payload,
  type: runTextOperation,
})
/**
 * User opened a saltpack file on from their file browser. Notified by OS and deeplinks
 */
export const createOnSaltpackOpenFile = (payload: _OnSaltpackOpenFilePayload): OnSaltpackOpenFilePayload => ({
  payload,
  type: onSaltpackOpenFile,
})
export const createRunFileOperation = (payload: _RunFileOperationPayload): RunFileOperationPayload => ({
  payload,
  type: runFileOperation,
})

// Action Payloads
export type ClearInputPayload = {readonly payload: _ClearInputPayload; readonly type: typeof clearInput}
export type ClearRecipientsPayload = {
  readonly payload: _ClearRecipientsPayload
  readonly type: typeof clearRecipients
}
export type DownloadEncryptedTextPayload = {
  readonly payload: _DownloadEncryptedTextPayload
  readonly type: typeof downloadEncryptedText
}
export type DownloadSignedTextPayload = {
  readonly payload: _DownloadSignedTextPayload
  readonly type: typeof downloadSignedText
}
export type OnOperationErrorPayload = {
  readonly payload: _OnOperationErrorPayload
  readonly type: typeof onOperationError
}
export type OnOperationSuccessPayload = {
  readonly payload: _OnOperationSuccessPayload
  readonly type: typeof onOperationSuccess
}
export type OnSaltpackOpenFilePayload = {
  readonly payload: _OnSaltpackOpenFilePayload
  readonly type: typeof onSaltpackOpenFile
}
export type ResetOperationPayload = {
  readonly payload: _ResetOperationPayload
  readonly type: typeof resetOperation
}
export type RunFileOperationPayload = {
  readonly payload: _RunFileOperationPayload
  readonly type: typeof runFileOperation
}
export type RunTextOperationPayload = {
  readonly payload: _RunTextOperationPayload
  readonly type: typeof runTextOperation
}
export type SaltpackDecryptPayload = {
  readonly payload: _SaltpackDecryptPayload
  readonly type: typeof saltpackDecrypt
}
export type SaltpackDonePayload = {readonly payload: _SaltpackDonePayload; readonly type: typeof saltpackDone}
export type SaltpackEncryptPayload = {
  readonly payload: _SaltpackEncryptPayload
  readonly type: typeof saltpackEncrypt
}
export type SaltpackProgressPayload = {
  readonly payload: _SaltpackProgressPayload
  readonly type: typeof saltpackProgress
}
export type SaltpackSignPayload = {readonly payload: _SaltpackSignPayload; readonly type: typeof saltpackSign}
export type SaltpackStartPayload = {
  readonly payload: _SaltpackStartPayload
  readonly type: typeof saltpackStart
}
export type SaltpackVerifyPayload = {
  readonly payload: _SaltpackVerifyPayload
  readonly type: typeof saltpackVerify
}
export type SetEncryptOptionsPayload = {
  readonly payload: _SetEncryptOptionsPayload
  readonly type: typeof setEncryptOptions
}
export type SetInputPayload = {readonly payload: _SetInputPayload; readonly type: typeof setInput}
export type SetInputThrottledPayload = {
  readonly payload: _SetInputThrottledPayload
  readonly type: typeof setInputThrottled
}
export type SetRecipientsPayload = {
  readonly payload: _SetRecipientsPayload
  readonly type: typeof setRecipients
}

// All Actions
// prettier-ignore
export type Actions =
  | ClearInputPayload
  | ClearRecipientsPayload
  | DownloadEncryptedTextPayload
  | DownloadSignedTextPayload
  | OnOperationErrorPayload
  | OnOperationSuccessPayload
  | OnSaltpackOpenFilePayload
  | ResetOperationPayload
  | RunFileOperationPayload
  | RunTextOperationPayload
  | SaltpackDecryptPayload
  | SaltpackDonePayload
  | SaltpackEncryptPayload
  | SaltpackProgressPayload
  | SaltpackSignPayload
  | SaltpackStartPayload
  | SaltpackVerifyPayload
  | SetEncryptOptionsPayload
  | SetInputPayload
  | SetInputThrottledPayload
  | SetRecipientsPayload
  | {type: 'common:resetStore', payload: {}}
