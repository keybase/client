// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
import * as I from 'immutable'

// Constants
export const resetStore = 'common:resetStore' // not a part of entities but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'entities:'
export const deleteEntity = 'entities:deleteEntity'
export const mergeEntity = 'entities:mergeEntity'
export const replaceEntity = 'entities:replaceEntity'
export const subtractEntity = 'entities:subtractEntity'

// Payload Types
type _DeleteEntityPayload = {readonly keyPath: Array<string>; readonly ids: I.List<string>}
type _MergeEntityPayload = {readonly keyPath: Array<string>; readonly entities: I.Map<any, any> | I.List<any>}
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
  | ReplaceEntityPayload
  | SubtractEntityPayload
  | {type: 'common:resetStore', payload: {}}
