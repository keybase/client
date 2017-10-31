// @flow
/* eslint-disable */
import {type PayloadType, type ReturnType} from '../constants/types/more'
import * as Constants from '../constants/entities'
import * as I from 'immutable'

// Constants
export const deleteEntity = 'entities:deleteEntity'
export const mergeEntity = 'entities:mergeEntity'
export const replaceEntity = 'entities:replaceEntity'
export const subtractEntity = 'entities:subtractEntity'

// Action Creators
export const createDeleteEntity = (payload: {|keyPath: Array<string>, ids: I.List<string>|}) => ({
  type: deleteEntity,
  error: false,
  payload,
})
export const createMergeEntity = (payload: {|keyPath: Array<string>, entities: I.Map<any, any> | I.List<any>|}) => ({
  type: mergeEntity,
  error: false,
  payload,
})
export const createReplaceEntity = (payload: {|keyPath: Array<string>, entities: I.Map<any, any> | I.List<any>|}) => ({
  type: replaceEntity,
  error: false,
  payload,
})
export const createSubtractEntity = (payload: {|keyPath: Array<string>, entities: I.List<any>|}) => ({
  type: subtractEntity,
  error: false,
  payload,
})

// Action Payloads
export type DeleteEntityPayload = ReturnType<typeof createDeleteEntity>
export type MergeEntityPayload = ReturnType<typeof createMergeEntity>
export type ReplaceEntityPayload = ReturnType<typeof createReplaceEntity>
export type SubtractEntityPayload = ReturnType<typeof createSubtractEntity>

// All Actions
// prettier-ignore
export type Actions =
  | ReturnType<typeof createDeleteEntity>
  | ReturnType<typeof createMergeEntity>
  | ReturnType<typeof createReplaceEntity>
  | ReturnType<typeof createSubtractEntity>
