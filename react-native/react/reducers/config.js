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
    default:
      return state
  }
}
