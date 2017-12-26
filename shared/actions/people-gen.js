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

// Action Creators
export const createGetPeopleData = (payload: {|+markViewed: boolean, +numFollowSuggestionsWanted: number|}) => ({error: false, payload, type: getPeopleData})
export const createPeopleDataProcessed = (payload: {|+oldItems: I.List<Types.PeopleScreenItem>, +newItems: I.List<Types.PeopleScreenItem>, +lastViewed: Date|}) => ({error: false, payload, type: peopleDataProcessed})

// Action Payloads
export type GetPeopleDataPayload = More.ReturnType<typeof createGetPeopleData>
export type PeopleDataProcessedPayload = More.ReturnType<typeof createPeopleDataProcessed>

// All Actions
// prettier-ignore
export type Actions =
  | More.ReturnType<typeof createGetPeopleData>
  | More.ReturnType<typeof createPeopleDataProcessed>
  | {type: 'common:resetStore', payload: void}
