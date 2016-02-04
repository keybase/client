/* @flow */

import * as Constants from '../../constants/signup'

import type {CheckInviteCodeCreator} from '../../constants/signup'

export function checkInviteCode (inviteCode: string): CheckInviteCodeCreator {
  return dispatch => {
    // TODO make service call
    dispatch({type: Constants.checkInviteCode, payload: {valid: true}})
  }
}
