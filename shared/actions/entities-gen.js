// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define,import/no-duplicates */

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
type _DeleteEntityPayload = $ReadOnly<{|keyPath: Array<string>, ids: I.List<string>|}>
type _MergeEntityPayload = $ReadOnly<{|keyPath: Array<string>, entities: I.Map<any, any> | I.List<any>|}>
type _ReplaceEntityPayload = $ReadOnly<{|keyPath: Array<string>, entities: I.Map<any, any> | I.List<any>|}>
type _SubtractEntityPayload = $ReadOnly<{|keyPath: Array<string>, entities: I.List<any>|}>

// Action Creators
export const createDeleteEntity = (payload: _DeleteEntityPayload) => ({payload, type: deleteEntity})
export const createMergeEntity = (payload: _MergeEntityPayload) => ({payload, type: mergeEntity})
export const createReplaceEntity = (payload: _ReplaceEntityPayload) => ({payload, type: replaceEntity})
export const createSubtractEntity = (payload: _SubtractEntityPayload) => ({payload, type: subtractEntity})

// Action Payloads
export type DeleteEntityPayload = {|+payload: _DeleteEntityPayload, +type: 'entities:deleteEntity'|}
export type MergeEntityPayload = {|+payload: _MergeEntityPayload, +type: 'entities:mergeEntity'|}
export type ReplaceEntityPayload = {|+payload: _ReplaceEntityPayload, +type: 'entities:replaceEntity'|}
export type SubtractEntityPayload = {|+payload: _SubtractEntityPayload, +type: 'entities:subtractEntity'|}

// All Actions
// prettier-ignore
export type Actions =
  | DeleteEntityPayload
  | MergeEntityPayload
  | ReplaceEntityPayload
  | SubtractEntityPayload
  | {type: 'common:resetStore', payload: null}
