/* @flow */

import * as Constants from '../constants/signup'

import type {SignupActions, CheckInviteCode} from '../constants/signup'

export type SignupState = {
  inviteCodeError: ?string,
}

const initialState: SignupState = {
  inviteCodeError: null
}

export default function (state: SignupState = initialState, action: SignupActions): SignupState {
  switch (action.type) {
    case Constants.checkInviteCode:
      // Assert this is the type we're looking at
      var _t: CheckInviteCode = action
      if (action.error && action.error === true) {
        return {
          ...state,
          inviteCodeError: action.payload.errorText
        }
      }
      return state
    default:
      return state
  }
}
