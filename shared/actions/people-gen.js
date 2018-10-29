// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/people'

// Constants
export const resetStore = 'common:resetStore' // not a part of people but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'people:'
export const getPeopleData = 'people:getPeopleData'
export const markViewed = 'people:markViewed'
export const peopleDataProcessed = 'people:peopleDataProcessed'
export const skipTodo = 'people:skipTodo'

// Payload Types
type _GetPeopleDataPayload = $ReadOnly<{|
  markViewed: boolean,
  numFollowSuggestionsWanted: number,
|}>
type _MarkViewedPayload = void
type _PeopleDataProcessedPayload = $ReadOnly<{|
  oldItems: I.List<Types.PeopleScreenItem>,
  newItems: I.List<Types.PeopleScreenItem>,
  followSuggestions: I.List<Types.FollowSuggestion>,
  lastViewed: Date,
  version: number,
|}>
type _SkipTodoPayload = $ReadOnly<{|type: Types.TodoType|}>

// Action Creators
export const createGetPeopleData = (payload: _GetPeopleDataPayload) => ({payload, type: getPeopleData})
export const createMarkViewed = (payload: _MarkViewedPayload) => ({payload, type: markViewed})
export const createPeopleDataProcessed = (payload: _PeopleDataProcessedPayload) => ({payload, type: peopleDataProcessed})
export const createSkipTodo = (payload: _SkipTodoPayload) => ({payload, type: skipTodo})

// Action Payloads
export type GetPeopleDataPayload = $Call<typeof createGetPeopleData, _GetPeopleDataPayload>
export type MarkViewedPayload = $Call<typeof createMarkViewed, _MarkViewedPayload>
export type PeopleDataProcessedPayload = $Call<typeof createPeopleDataProcessed, _PeopleDataProcessedPayload>
export type SkipTodoPayload = $Call<typeof createSkipTodo, _SkipTodoPayload>

// All Actions
// prettier-ignore
export type Actions =
  | GetPeopleDataPayload
  | MarkViewedPayload
  | PeopleDataProcessedPayload
  | SkipTodoPayload
  | {type: 'common:resetStore', payload: void}
