// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as More from '../constants/types/more'
import * as Types from '../constants/types/people'

// Constants
export const resetStore = 'common:resetStore' // not a part of people but is handled by every reducer
export const getPeopleData = 'people:getPeopleData'
export const peopleDataProcessed = 'people:peopleDataProcessed'
export const setupPeopleHandlers = 'people:setupPeopleHandlers'
export const skipTodo = 'people:skipTodo'

// Action Creators
export const createGetPeopleData = (payload: {|+markViewed: boolean, +numFollowSuggestionsWanted: number|}) => ({error: false, payload, type: getPeopleData})
export const createPeopleDataProcessed = (payload: {|+oldItems: I.List<Types.PeopleScreenItem>, +newItems: I.List<Types.PeopleScreenItem>, +followSuggestions: I.List<Types.FollowSuggestion>, +lastViewed: Date, +version: number|}) => ({error: false, payload, type: peopleDataProcessed})
export const createSetupPeopleHandlers = () => ({error: false, payload: undefined, type: setupPeopleHandlers})
export const createSkipTodo = (payload: {|+type: Types.TodoType|}) => ({error: false, payload, type: skipTodo})

// Action Payloads
export type GetPeopleDataPayload = More.ReturnType<typeof createGetPeopleData>
export type PeopleDataProcessedPayload = More.ReturnType<typeof createPeopleDataProcessed>
export type SetupPeopleHandlersPayload = More.ReturnType<typeof createSetupPeopleHandlers>
export type SkipTodoPayload = More.ReturnType<typeof createSkipTodo>

// All Actions
// prettier-ignore
export type Actions =
  | More.ReturnType<typeof createGetPeopleData>
  | More.ReturnType<typeof createPeopleDataProcessed>
  | More.ReturnType<typeof createSetupPeopleHandlers>
  | More.ReturnType<typeof createSkipTodo>
  | {type: 'common:resetStore', payload: void}
