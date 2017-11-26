// @flow
import * as DevGen from '../actions/dev-gen'
import * as Constants from '../constants/dev'
import * as Types from '../constants/types/dev'

export default function(state: Types.State = Constants.initialState, action: DevGen.Actions) {
  switch (action.type) {
    case DevGen.resetStore:
      return {...Constants.initialState}
    case DevGen.updateDebugConfig:
      const {config} = action.payload
      return {
        ...state,
        debugConfig: {...state.debugConfig, ...config},
      }
    case DevGen.updatehmrReloading:
      const {reloading} = action.payload
      return {
        ...state,
        reloading,
      }
    case DevGen.debugCount:
      return {
        ...state,
        debugCount: state.debugCount + 1,
      }
  }

  return state
}
