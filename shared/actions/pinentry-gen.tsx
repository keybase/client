// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'

// Constants
export const resetStore = 'common:resetStore' // not a part of pinentry but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'pinentry:'
export const deleteEntity = 'pinentry:deleteEntity'
export const mergeEntity = 'pinentry:mergeEntity'
export const newPinentry = 'pinentry:newPinentry'
export const onCancel = 'pinentry:onCancel'
export const onSubmit = 'pinentry:onSubmit'
export const replaceEntity = 'pinentry:replaceEntity'
export const subtractEntity = 'pinentry:subtractEntity'

// Payload Types
type _DeleteEntityPayload = {readonly keyPath: Array<string>; readonly ids: Iterable<any>}
type _MergeEntityPayload = {readonly keyPath: Array<string>; readonly entities: I.Map<any, any> | I.List<any>}
type _NewPinentryPayload = {
  readonly showTyping: RPCTypes.Feature
  readonly type: RPCTypes.PassphraseType
  readonly sessionID: number
  readonly prompt: string
  readonly windowTitle: string
  readonly submitLabel: string | null
  readonly cancelLabel: string | null
  readonly retryLabel: string | null
}
type _OnCancelPayload = {readonly sessionID: number}
type _OnSubmitPayload = {readonly sessionID: number; readonly password: string}
type _ReplaceEntityPayload = {
  readonly keyPath: Array<string>
  readonly entities: I.Map<any, any> | I.List<any>
}
type _SubtractEntityPayload = {readonly keyPath: Array<string>; readonly entities: I.List<any>}

// Action Creators
export const createDeleteEntity = (payload: _DeleteEntityPayload): DeleteEntityPayload => ({
  payload,
  type: deleteEntity,
})
export const createMergeEntity = (payload: _MergeEntityPayload): MergeEntityPayload => ({
  payload,
  type: mergeEntity,
})
export const createNewPinentry = (payload: _NewPinentryPayload): NewPinentryPayload => ({
  payload,
  type: newPinentry,
})
export const createOnCancel = (payload: _OnCancelPayload): OnCancelPayload => ({payload, type: onCancel})
export const createOnSubmit = (payload: _OnSubmitPayload): OnSubmitPayload => ({payload, type: onSubmit})
export const createReplaceEntity = (payload: _ReplaceEntityPayload): ReplaceEntityPayload => ({
  payload,
  type: replaceEntity,
})
export const createSubtractEntity = (payload: _SubtractEntityPayload): SubtractEntityPayload => ({
  payload,
  type: subtractEntity,
})

// Action Payloads
export type DeleteEntityPayload = {readonly payload: _DeleteEntityPayload; readonly type: typeof deleteEntity}
export type MergeEntityPayload = {readonly payload: _MergeEntityPayload; readonly type: typeof mergeEntity}
export type NewPinentryPayload = {readonly payload: _NewPinentryPayload; readonly type: typeof newPinentry}
export type OnCancelPayload = {readonly payload: _OnCancelPayload; readonly type: typeof onCancel}
export type OnSubmitPayload = {readonly payload: _OnSubmitPayload; readonly type: typeof onSubmit}
export type ReplaceEntityPayload = {
  readonly payload: _ReplaceEntityPayload
  readonly type: typeof replaceEntity
}
export type SubtractEntityPayload = {
  readonly payload: _SubtractEntityPayload
  readonly type: typeof subtractEntity
}

// All Actions
// prettier-ignore
export type Actions =
  | DeleteEntityPayload
  | MergeEntityPayload
  | NewPinentryPayload
  | OnCancelPayload
  | OnSubmitPayload
  | ReplaceEntityPayload
  | SubtractEntityPayload
  | {type: 'common:resetStore', payload: {}}
