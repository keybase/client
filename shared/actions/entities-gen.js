// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as More from '../constants/types/more'
import * as Constants from '../constants/entities'

// Constants
export const resetStore = 'common:resetStore' // not a part of entities but is handled by every reducer
export const deleteEntity = 'entities:deleteEntity'
export const mergeEntity = 'entities:mergeEntity'
export const replaceEntity = 'entities:replaceEntity'
export const subtractEntity = 'entities:subtractEntity'

// Action Creators
export const createDeleteEntity = (
  payload: $ReadOnly<{|
    keyPath: Array<string>,
    ids: I.List<string>,
  |}>
) => ({error: false, payload, type: deleteEntity})
export const createMergeEntity = (
  payload: $ReadOnly<{|
    keyPath: Array<string>,
    entities: I.Map<any, any> | I.List<any>,
  |}>
) => ({error: false, payload, type: mergeEntity})
export const createReplaceEntity = (
  payload: $ReadOnly<{|
    keyPath: Array<string>,
    entities: I.Map<any, any> | I.List<any>,
  |}>
) => ({error: false, payload, type: replaceEntity})
export const createSubtractEntity = (
  payload: $ReadOnly<{|
    keyPath: Array<string>,
    entities: I.List<any>,
  |}>
) => ({error: false, payload, type: subtractEntity})

// Action Payloads
export type DeleteEntityPayload = More.ReturnType<typeof createDeleteEntity>
export type MergeEntityPayload = More.ReturnType<typeof createMergeEntity>
export type ReplaceEntityPayload = More.ReturnType<typeof createReplaceEntity>
export type SubtractEntityPayload = More.ReturnType<typeof createSubtractEntity>

// All Actions
// prettier-ignore
export type Actions =
  | More.ReturnType<typeof createDeleteEntity>
  | More.ReturnType<typeof createMergeEntity>
  | More.ReturnType<typeof createReplaceEntity>
  | More.ReturnType<typeof createSubtractEntity>
  | {type: 'common:resetStore', payload: void}
