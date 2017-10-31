// @flow
/* eslint-disable */

// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import {type PayloadType, type ReturnType} from '../constants/types/more'
import * as Constants from '../constants/entities'
import * as I from 'immutable'

// Constants
export const deleteEntity = 'entities:deleteEntity'
export const mergeEntity = 'entities:mergeEntity'
export const replaceEntity = 'entities:replaceEntity'
export const subtractEntity = 'entities:subtractEntity'

// Action Creators
export const createDeleteEntity = (payload: {|keyPath: Array<string>, ids: I.List<string>|}) => ({error: false, payload, type: deleteEntity})
export const createMergeEntity = (payload: {|keyPath: Array<string>, entities: I.Map<any, any> | I.List<any>|}) => ({error: false, payload, type: mergeEntity})
export const createReplaceEntity = (payload: {|keyPath: Array<string>, entities: I.Map<any, any> | I.List<any>|}) => ({error: false, payload, type: replaceEntity})
export const createSubtractEntity = (payload: {|keyPath: Array<string>, entities: I.List<any>|}) => ({error: false, payload, type: subtractEntity})

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
