// @flow
import * as CommonConstants from '../constants/common'
import * as Constants from '../constants/push'

import type {State} from '../constants/push'

function reducer(state: State = Constants.initialState, action: any): State {
  switch (action.type) {
    case CommonConstants.resetStore:
      return {...Constants.initialState}
    case Constants.permissionsRequesting:
      const permissionsRequesting = action.payload
      return {
        ...state,
        permissionsRequesting,
      }
    case Constants.permissionsPrompt:
      return {
        ...state,
        permissionsPrompt: action.payload,
      }
    case Constants.updatePushToken:
      const {token, tokenType} = action.payload
      return {
        ...state,
        token,
        tokenType,
      }
  }
  return state
}

export default reducer
