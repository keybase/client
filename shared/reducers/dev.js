// @flow
import * as CommonConstants from '../constants/common'
import * as Constants from '../constants/dev'

const initialState: Constants.State = {
  debugConfig: {
    dumbFilter: '',
    dumbFullscreen: false,
    dumbIndex: 0,
  },
  hmrReloading: false,
}

export default function(state: Constants.State = initialState, action: Constants.Actions) {
  if (action.type === CommonConstants.resetStore) {
    return {...initialState}
  }

  if (action.type === Constants.updateDebugConfig) {
    return {
      ...state,
      debugConfig: {...state.debugConfig, ...action.payload},
    }
  }

  if (action.type === Constants.updateReloading && !action.error) {
    return {
      ...state,
      reloading: action.payload.reloading,
    }
  }
  return state
}
