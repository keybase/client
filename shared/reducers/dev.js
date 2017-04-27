// @flow
import * as CommonConstants from '../constants/common'
import {updateDebugConfig, updateReloading} from '../constants/dev'

import type {DebugConfig, Actions} from '../constants/dev'

export type State = {
  debugConfig: DebugConfig,
  hmrReloading: boolean,
}

const initialState: State = {
  debugConfig: {
    dumbFilter: '',
    dumbFullscreen: false,
    dumbIndex: 0,
  },
  hmrReloading: false,
}

export default function (state: State = initialState, action: Actions) {
  if (action.type === CommonConstants.resetStore) {
    return {...initialState}
  }

  if (action.type === updateDebugConfig) {
    return {
      ...state,
      debugConfig: {...state.debugConfig, ...action.payload},
    }
  }

  if (action.type === updateReloading && !action.error) {
    return {
      ...state,
      reloading: action.payload.reloading,
    }
  }
  return state
}
