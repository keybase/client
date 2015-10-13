'use strict'

import * as types from '../constants/configActionTypes'

const initialState = {
  loaded: false,
  error: null
}

export default function (state = initialState, action) {
  switch (action.type) {
    case types.CONFIG_LOADING:
      return {
        ...state,
        loaded: false,
        config: null,
        error: null
      }
    case types.CONFIG_ERRORED:
      return {
        ...state,
        loaded: true,
        error: action.error
      }
    case types.CONFIG_LOADED:
      return {
        ...state,
        ...action.config,
        loaded: true,
        error: null
      }
    case types.DEV_CONFIG_LOADING:
      return {
        ...state,
        devConfig: null
      }
    case types.DEV_CONFIG_LOADED:
      return {
        ...state,
        devConfig: action.devConfig
      }
    case types.DEV_CONFIG_SAVED:
      return {
        ...state,
        devConfig: null
      }
    case types.DEV_CONFIG_UPDATE:
      return {
        ...state,
        devConfig: {
          ...state.devConfig,
          configured: {
            ...state.devConfig.configured,
            ...action.updates
          }
        }
      }
    default:
      return state
  }
}
