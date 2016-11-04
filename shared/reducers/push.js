// @flow
import * as Constants from '../constants/push'

import type {State} from '../constants/push'

const initialState: State = {
  permissionsPrompt: false,
  permissionsRequesting: false,
  tokenType: '',
  token: '',
}

function reducer (state: State = initialState, action: any): State {
  switch (action.type) {
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
