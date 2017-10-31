// @flow
/* eslint-disable */

// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import {type PayloadType, type ReturnType} from '../constants/types/more'
import * as Constants from '../constants/signup'

// Constants
export const checkInviteCode = 'signup:checkInviteCode'

// Action Creators
export const createCheckInviteCode = (payload: {|inviteCode: string|}) => ({error: false, payload, type: checkInviteCode})
export const createCheckInviteCodeError = (payload: {|errorText: string|}) => ({error: true, payload, type: checkInviteCode})

// Action Payloads
export type CheckInviteCodePayload = ReturnType<typeof createCheckInviteCode>

// All Actions
// prettier-ignore
export type Actions =
  | ReturnType<typeof createCheckInviteCode>
  | ReturnType<typeof createCheckInviteCodeError>
