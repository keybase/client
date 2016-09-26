// @flow
import * as CommonConstants from '../constants/common'
import * as Constants from '../constants/settings'
import type {Actions, State} from '../constants/settings'

const initialState: State = {
  notifications: {
    settings: null,
    unsubscribedFromAll: null,
  },
}

function reducer (state: State = initialState, action: Actions) {
  switch (action.type) {
    case CommonConstants.resetStore:
      return {...initialState}
    case Constants.notificationsRefreshed:
      if (action.error) { break }
      return {
        ...state,
        notifications: action.payload,
      }
  }

  return state
}

export default reducer
