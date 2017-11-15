// @flow
import * as DevGen from '../actions/dev-gen'
import * as Constants from '../constants/dev'
import * as Types from '../constants/types/dev'

const resetStore = 'common:resetStore' // not a part of dev but is handled by every reducer
const debugCount = 'dev:debugCount'
const updateDebugConfig = 'dev:updateDebugConfig'
const updatehmrReloading = 'dev:updatehmrReloading'
const reducerMap: DevGen.ReducerMap = {
  [resetStore]: (state, action) => ({
    ...Constants.initialState,
  }),
  [updateDebugConfig]: (state, action) => {
    const {config} = action.payload
    return {
      ...state,
      debugConfig: {...state.debugConfig, ...config},
    }
  },
  [updatehmrReloading]: (state, action) => {
    const {reloading} = action.payload
    return {
      ...state,
      reloading,
    }
  },

  [debugCount]: (state, action) => {
    return {
      ...state,
      debugCount: state.debugCount + 1,
    }
  },
}

export default function(state: Types.State = Constants.initialState, action: DevGen.Actions) {
  const reducer = reducerMap[action.type]
  if (reducer) {
    return reducer(state, action)
  }
  return state
}
