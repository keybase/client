'use strict'

import * as types from '../constants/config-action-types'

const initialState = {
  loaded: false,
  status: null,
  config: null,
  error: null
}

export default function (state = initialState, action) {
  switch (action.type) {
    case types.STARTUP_LOADING:
      return {
        ...state,
        loaded: false,
        config: null,
        status: null,
        error: null
      }
    case types.STARTUP_LOADED:
      return {
        ...state,
        config: action.error ? null : action.payload.config,
        status: action.error ? null : action.payload.status,
        loaded: !action.error,
        error: action.error ? action.payload : null
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
