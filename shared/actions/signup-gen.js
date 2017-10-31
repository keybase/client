// @flow
/* eslint-disable */
import {type PayloadType, type ReturnType} from '../constants/types/more'
import * as Constants from '../constants/signup'

// Constants
export const checkInviteCode = 'signup:checkInviteCode'

// Action Creators
export const createCheckInviteCode = (payload: {|inviteCode: string|}) => ({
  type: checkInviteCode,
  error: false,
  payload,
})
export const createCheckInviteCodeError = (payload: {|errorText: string|}) => ({
  type: checkInviteCode,
  error: true,
  payload,
})

// Action Payloads
export type CheckInviteCodePayload = ReturnType<typeof createCheckInviteCode>

// All Actions
// prettier-ignore
export type Actions =
  | ReturnType<typeof createCheckInviteCode>
  | ReturnType<typeof createCheckInviteCodeError>
