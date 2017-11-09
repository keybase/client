// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/flow-types'
import * as More from '../constants/types/more'
import * as Constants from '../constants/signup'

// Constants
export const resetStore = 'common:resetStore' // not a part of signup but is handled by every reducer
export const checkInviteCode = 'signup:checkInviteCode'

// Action Creators
export const createCheckInviteCode = (payload: {|inviteCode: string|}) => ({error: false, payload, type: checkInviteCode})
export const createCheckInviteCodeError = (payload: {|errorText: string|}) => ({error: true, payload, type: checkInviteCode})

// Action Payloads
export type CheckInviteCodePayload = More.ReturnType<typeof createCheckInviteCode>

// All Actions
// prettier-ignore
export type Actions =
  | More.ReturnType<typeof createCheckInviteCode>
  | More.ReturnType<typeof createCheckInviteCodeError>
  | {type: 'common:resetStore', payload: void}
