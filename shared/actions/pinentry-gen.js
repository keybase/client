// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Constants from '../constants/pinentry'

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
type _DeleteEntityPayload = $ReadOnly<{|keyPath: Array<string>, ids: Iterable<any>|}>
type _MergeEntityPayload = $ReadOnly<{|keyPath: Array<string>, entities: I.Map<any, any> | I.List<any>|}>
type _NewPinentryPayload = $ReadOnly<{|showTyping: RPCTypes.Feature, type: RPCTypes.PassphraseType, sessionID: number, prompt: string, windowTitle: string, submitLabel: ?string, cancelLabel: ?string, retryLabel: ?string|}>
type _OnCancelPayload = $ReadOnly<{|sessionID: number|}>
type _OnSubmitPayload = $ReadOnly<{|sessionID: number, passphrase: string|}>
type _ReplaceEntityPayload = $ReadOnly<{|keyPath: Array<string>, entities: I.Map<any, any> | I.List<any>|}>
type _SubtractEntityPayload = $ReadOnly<{|keyPath: Array<string>, entities: I.List<any>|}>

// Action Creators
export const createDeleteEntity = (payload: _DeleteEntityPayload) => ({payload, type: deleteEntity})
export const createMergeEntity = (payload: _MergeEntityPayload) => ({payload, type: mergeEntity})
export const createNewPinentry = (payload: _NewPinentryPayload) => ({payload, type: newPinentry})
export const createOnCancel = (payload: _OnCancelPayload) => ({payload, type: onCancel})
export const createOnSubmit = (payload: _OnSubmitPayload) => ({payload, type: onSubmit})
export const createReplaceEntity = (payload: _ReplaceEntityPayload) => ({payload, type: replaceEntity})
export const createSubtractEntity = (payload: _SubtractEntityPayload) => ({payload, type: subtractEntity})

// Action Payloads
export type DeleteEntityPayload = $Call<typeof createDeleteEntity, _DeleteEntityPayload>
export type MergeEntityPayload = $Call<typeof createMergeEntity, _MergeEntityPayload>
export type NewPinentryPayload = $Call<typeof createNewPinentry, _NewPinentryPayload>
export type OnCancelPayload = $Call<typeof createOnCancel, _OnCancelPayload>
export type OnSubmitPayload = $Call<typeof createOnSubmit, _OnSubmitPayload>
export type ReplaceEntityPayload = $Call<typeof createReplaceEntity, _ReplaceEntityPayload>
export type SubtractEntityPayload = $Call<typeof createSubtractEntity, _SubtractEntityPayload>

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
  | {type: 'common:resetStore', payload: void}
