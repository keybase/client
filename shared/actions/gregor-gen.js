// @flow
/* eslint-disable */

// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import {type PayloadType, type ReturnType} from '../constants/types/more'
import * as Constants from '../constants/gregor'
import * as RPCTypes from '../constants/types/flow-types'
import * as GregorTypes from '../constants/types/flow-types-gregor'

// Constants
export const resetStore = 'common:resetStore' // not a part of gregor but is handled by every reducer
export const pushState = 'gregor:pushState'

// Action Creators
export const createPushState = (payload: {|state: GregorTypes.State, reason: RPCTypes.PushReason|}) => ({error: false, payload, type: pushState})

// Action Payloads
export type PushStatePayload = ReturnType<typeof createPushState>

// All Actions
// prettier-ignore
export type Actions =
  | ReturnType<typeof createPushState>
  | {type: 'common:resetStore', payload: void}
