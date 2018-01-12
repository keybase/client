// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as More from '../constants/types/more'

// Constants
export const resetStore = 'common:resetStore' // not a part of fs but is handled by every reducer
export const increaseCount = 'fs:increaseCount'

// Action Creators
export const createIncreaseCount = (payload: $ReadOnly<{amount?: number}>) => ({error: false, payload, type: increaseCount})

// Action Payloads
export type IncreaseCountPayload = More.ReturnType<typeof createIncreaseCount>

// All Actions
// prettier-ignore
export type Actions =
  | More.ReturnType<typeof createIncreaseCount>
  | {type: 'common:resetStore', payload: void}
