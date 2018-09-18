// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Constants from '../constants/entities'

// Constants
export const resetStore = 'common:resetStore' // not a part of entities but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'entities:'
export const deleteEntity = 'entities:deleteEntity'
export const mergeEntity = 'entities:mergeEntity'
export const replaceEntity = 'entities:replaceEntity'
export const subtractEntity = 'entities:subtractEntity'

// Payload Types
type _DeleteEntityPayload = $ReadOnly<{|
  keyPath: Array<string>,
  ids: I.List<string>,
|}>
type _MergeEntityPayload = $ReadOnly<{|
  keyPath: Array<string>,
  entities: I.Map<any, any> | I.List<any>,
|}>
type _ReplaceEntityPayload = $ReadOnly<{|
  keyPath: Array<string>,
  entities: I.Map<any, any> | I.List<any>,
|}>
type _SubtractEntityPayload = $ReadOnly<{|
  keyPath: Array<string>,
  entities: I.List<any>,
|}>

// Action Creators
export const createDeleteEntity = (payload: _DeleteEntityPayload) => ({error: false, payload, type: deleteEntity})
export const createMergeEntity = (payload: _MergeEntityPayload) => ({error: false, payload, type: mergeEntity})
export const createReplaceEntity = (payload: _ReplaceEntityPayload) => ({error: false, payload, type: replaceEntity})
export const createSubtractEntity = (payload: _SubtractEntityPayload) => ({error: false, payload, type: subtractEntity})

// Action Payloads
export type DeleteEntityPayload = $Call<typeof createDeleteEntity, _DeleteEntityPayload>
export type MergeEntityPayload = $Call<typeof createMergeEntity, _MergeEntityPayload>
export type ReplaceEntityPayload = $Call<typeof createReplaceEntity, _ReplaceEntityPayload>
export type SubtractEntityPayload = $Call<typeof createSubtractEntity, _SubtractEntityPayload>

// All Actions
// prettier-ignore
export type Actions =
  | DeleteEntityPayload
  | MergeEntityPayload
  | ReplaceEntityPayload
  | SubtractEntityPayload
  | {type: 'common:resetStore', payload: void}
