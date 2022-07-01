// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import type * as Types from '../constants/types/crypto'
import type HiddenString from '../util/hidden-string'

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

// Action Creators
/**
 * Array recipients of operations, provided via TeamBuilding.
 * Includes flag if any users are not on Keybase yet (SBS) to force includeSelf in EncryptOptions
 */
export const createSetRecipients = (payload: {
  readonly operation: Types.Operations
  readonly recipients: Array<string>
  readonly hasSBS: boolean
}) => ({payload, type: setRecipients as typeof setRecipients})
/**
 * Calls Saltpack RPC
 */
export const createSaltpackDecrypt = (payload: {
  readonly input: HiddenString
  readonly type: Types.InputTypes
  readonly destinationDir?: HiddenString
}) => ({payload, type: saltpackDecrypt as typeof saltpackDecrypt})
/**
 * Calls Saltpack RPC
 */
export const createSaltpackEncrypt = (payload: {
  readonly input: HiddenString
  readonly options: Types.EncryptOptions
  readonly recipients: Array<string>
  readonly type: Types.InputTypes
  readonly destinationDir?: HiddenString
}) => ({payload, type: saltpackEncrypt as typeof saltpackEncrypt})
/**
 * Calls Saltpack RPC
 */
export const createSaltpackSign = (payload: {
  readonly input: HiddenString
  readonly type: Types.InputTypes
  readonly destinationDir?: HiddenString
}) => ({payload, type: saltpackSign as typeof saltpackSign})
/**
 * Calls Saltpack RPC
 */
export const createSaltpackVerify = (payload: {
  readonly input: HiddenString
  readonly type: Types.InputTypes
  readonly destinationDir?: HiddenString
}) => ({payload, type: saltpackVerify as typeof saltpackVerify})
/**
 * Clear input type and value from the specified operation
 */
export const createClearInput = (payload: {readonly operation: Types.Operations}) => ({
  payload,
  type: clearInput as typeof clearInput,
})
/**
 * Download the encrypted output to a text file
 */
export const createDownloadEncryptedText = (payload?: undefined) => ({
  payload,
  type: downloadEncryptedText as typeof downloadEncryptedText,
})
/**
 * Download the signed output to a text file
 */
export const createDownloadSignedText = (payload?: undefined) => ({
  payload,
  type: downloadSignedText as typeof downloadSignedText,
})
/**
 * On saltpack RPC error response
 */
export const createOnOperationError = (payload: {
  readonly operation: Types.Operations
  readonly errorMessage: HiddenString
}) => ({payload, type: onOperationError as typeof onOperationError})
/**
 * On saltpack RPC successful response. input is the operation that started it
 */
export const createOnOperationSuccess = (payload: {
  readonly input: any
  readonly operation: Types.Operations
  readonly output: HiddenString
  readonly outputSenderUsername?: HiddenString
  readonly outputSenderFullname?: HiddenString
  readonly outputSigned: boolean
  readonly outputType: Types.OutputType
  readonly warning?: boolean
  readonly warningMessage?: HiddenString
}) => ({payload, type: onOperationSuccess as typeof onOperationSuccess})
/**
 * Progress logging
 */
export const createSaltpackDone = (payload: {
  readonly filename: HiddenString
  readonly operation: Types.Operations
}) => ({payload, type: saltpackDone as typeof saltpackDone})
/**
 * Progress logging
 */
export const createSaltpackProgress = (payload: {
  readonly bytesComplete: number
  readonly bytesTotal: number
  readonly filename: HiddenString
  readonly operation: Types.Operations
}) => ({payload, type: saltpackProgress as typeof saltpackProgress})
/**
 * Progress logging
 */
export const createSaltpackStart = (payload: {
  readonly filename: HiddenString
  readonly operation: Types.Operations
}) => ({payload, type: saltpackStart as typeof saltpackStart})
/**
 * Remove all recipients from operation
 */
export const createClearRecipients = (payload: {readonly operation: Types.Operations}) => ({
  payload,
  type: clearRecipients as typeof clearRecipients,
})
/**
 * Resets all values in the store for the given operation
 */
export const createResetOperation = (payload: {readonly operation: Types.Operations}) => ({
  payload,
  type: resetOperation as typeof resetOperation,
})
/**
 * Same as setInput but throttled
 */
export const createSetInputThrottled = (payload: {
  readonly operation: Types.Operations
  readonly type: Types.InputTypes
  readonly value: HiddenString
}) => ({payload, type: setInputThrottled as typeof setInputThrottled})
/**
 * Set input type (text, file) and value on user input. Either keyboard input or drag-and-drop file
 */
export const createSetInput = (payload: {
  readonly operation: Types.Operations
  readonly type: Types.InputTypes
  readonly value: HiddenString
}) => ({payload, type: setInput as typeof setInput})
/**
 * Sets options for encrypt operations.
 * Also takes `hideIncludeSelf` to disable includeSelf when user includes themselves as a recipient
 */
export const createSetEncryptOptions = (payload: {
  readonly options: Types.EncryptOptions
  readonly hideIncludeSelf?: boolean
}) => ({payload, type: setEncryptOptions as typeof setEncryptOptions})
/**
 * Used on mobile to split input/output steps
 */
export const createRunTextOperation = (payload: {readonly operation: Types.Operations}) => ({
  payload,
  type: runTextOperation as typeof runTextOperation,
})
/**
 * User opened a saltpack file on from their file browser. Notified by OS and deeplinks
 */
export const createOnSaltpackOpenFile = (payload: {
  readonly operation: Types.Operations
  readonly path: HiddenString
}) => ({payload, type: onSaltpackOpenFile as typeof onSaltpackOpenFile})
export const createRunFileOperation = (payload: {
  readonly operation: Types.Operations
  readonly destinationDir: HiddenString
}) => ({payload, type: runFileOperation as typeof runFileOperation})

// Action Payloads
export type ClearInputPayload = ReturnType<typeof createClearInput>
export type ClearRecipientsPayload = ReturnType<typeof createClearRecipients>
export type DownloadEncryptedTextPayload = ReturnType<typeof createDownloadEncryptedText>
export type DownloadSignedTextPayload = ReturnType<typeof createDownloadSignedText>
export type OnOperationErrorPayload = ReturnType<typeof createOnOperationError>
export type OnOperationSuccessPayload = ReturnType<typeof createOnOperationSuccess>
export type OnSaltpackOpenFilePayload = ReturnType<typeof createOnSaltpackOpenFile>
export type ResetOperationPayload = ReturnType<typeof createResetOperation>
export type RunFileOperationPayload = ReturnType<typeof createRunFileOperation>
export type RunTextOperationPayload = ReturnType<typeof createRunTextOperation>
export type SaltpackDecryptPayload = ReturnType<typeof createSaltpackDecrypt>
export type SaltpackDonePayload = ReturnType<typeof createSaltpackDone>
export type SaltpackEncryptPayload = ReturnType<typeof createSaltpackEncrypt>
export type SaltpackProgressPayload = ReturnType<typeof createSaltpackProgress>
export type SaltpackSignPayload = ReturnType<typeof createSaltpackSign>
export type SaltpackStartPayload = ReturnType<typeof createSaltpackStart>
export type SaltpackVerifyPayload = ReturnType<typeof createSaltpackVerify>
export type SetEncryptOptionsPayload = ReturnType<typeof createSetEncryptOptions>
export type SetInputPayload = ReturnType<typeof createSetInput>
export type SetInputThrottledPayload = ReturnType<typeof createSetInputThrottled>
export type SetRecipientsPayload = ReturnType<typeof createSetRecipients>

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
  | {readonly type: 'common:resetStore', readonly payload: undefined}
