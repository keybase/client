// @flow
import * as CommonConstants from '../constants/common'
import * as Constants from '../constants/profile'
import type {Actions, State} from '../constants/profile'

const initialState: State = {
  error: null,
  waiting: false,
  username: '',
  platform: null,
  usernameValid: true,
  revoke: {},
}

export default function (state: State = initialState, action: Actions) {
  switch (action.type) {
    case CommonConstants.resetStore:
      return {...initialState}
    case Constants.waiting:
      if (action.error) {
        break
      }
      return {
        ...state,
        waiting: action.payload.waiting,
      }
    case Constants.updatePlatform:
      if (action.error) {
        break
      }
      return {
        ...state,
        platform: action.payload.platform,
      }
    case Constants.updateUsername:
      if (action.error) {
        break
      }
      return {
        ...state,
        username: action.payload.username,
      }
    case Constants.waitingRevokeProof:
      if (action.error) {
        break
      }
      return {
        ...state,
        revoke: {
          ...state.revoke,
          waiting: action.payload.waiting,
        },
      }
    case Constants.finishRevokeProof:
      return {
        ...state,
        revoke: action.error
          ? {error: action.payload.error}
          : {},
      }
  }

  return state
}
