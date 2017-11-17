// @flow
import * as DevGen from '../actions/dev-gen'
import * as Constants from '../constants/dev'
import * as Types from '../constants/types/dev'

const updateDebugConfig = (state, action) => {
  const {config} = action.payload
  return {
    ...state,
    debugConfig: {...state.debugConfig, ...config},
  }
}

const updatehmrReloading = (state, action) => {
  const {reloading} = action.payload
  return {
    ...state,
    reloading,
  }
}

const debugCount = (state, action) => {
  return {
    ...state,
    debugCount: state.debugCount + 1,
  }
}

export default function(state: Types.State = Constants.initialState, action: DevGen.Actions) {
  switch (action.type) {
    case DevGen.resetStore:
      return {...Constants.initialState}
    case DevGen.updateDebugConfig:
      return updateDebugConfig(state, action)
    case DevGen.updatehmrReloading:
      return updatehmrReloading(state, action)
    case DevGen.debugCount:
      return debugCount(state, action)
    default:
      // eslint-disable-next-line no-unused-expressions
      (action: empty) // if you get a flow error here it means there's an action you claim to handle but didn't
      return state
  }
}
