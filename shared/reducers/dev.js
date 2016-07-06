/* @flow */

import {updateDebugConfig} from '../constants/dev'
import type {State} from '../constants/reducer'
import type {DebugConfig, DevAction} from '../constants/dev'

type DevState = {
  debugConfig: DebugConfig,
}

const initialState: DevState = {
  debugConfig: {
    dumbFilter: '',
    dumbIndex: 0,
    dumbFullscreen: false,
  },
}

export default function (state: DevState = initialState, action: DevAction): State {
  if (action.type === updateDebugConfig) {
    return {
      ...state,
      debugConfig: {...state.debugConfig, ...action.value},
    }
  }
  return state
}
