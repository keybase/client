// @flow
/* eslint-disable */
import * as Constants from '../constants/signup'

type _ExtractReturn<B, F: (...args: any[]) => B> = B
export type ReturnType<F> = _ExtractReturn<*, F>
export type PayloadType<F> = $PropertyType<ReturnType<F>, 'payload'>

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

// All Actions
export type Actions = ReturnType<typeof createCheckInviteCode> | ReturnType<typeof createCheckInviteCodeError>
