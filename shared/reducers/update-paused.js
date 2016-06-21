/* @flow */

import * as Constants from '../constants/update'
import * as CommonConstants from '../constants/common'

import type {UpdatePausedActions} from '../constants/update'

export type UpdatePausedState = {
  closed: boolean
}

const initialState: UpdatePausedState = {
  closed: true,
}

export default function (state: UpdatePausedState = initialState, action: UpdatePausedActions): UpdatePausedState {
  switch (action.type) {
    case CommonConstants.resetStore:
      return {...initialState}
    case Constants.showUpdatePaused:
      return {
        ...state,
        closed: false,
      }
    case Constants.onForce:
      return {...state, closed: true}
    case Constants.onCancel:
      return {...state, closed: true}
    case Constants.onSnooze:
      return {...state, closed: true}
    default:
      return state
  }
}
