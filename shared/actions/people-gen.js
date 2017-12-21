// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/flow-types'
import * as More from '../constants/types/more'

// Constants
export const resetStore = 'common:resetStore' // not a part of people but is handled by every reducer
export const getPeopleData = 'people:getPeopleData'

// Action Creators
export const createGetPeopleData = (payload: {|+markViewed: boolean, +numFollowSuggestionsWanted: number|}) => ({error: false, payload, type: getPeopleData})

// Action Payloads
export type GetPeopleDataPayload = More.ReturnType<typeof createGetPeopleData>

// All Actions
// prettier-ignore
export type Actions =
  | More.ReturnType<typeof createGetPeopleData>
  | {type: 'common:resetStore', payload: void}
