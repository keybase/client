'use strict'

import * as types from '../constants/configActionTypes'

const initialState = {
  loaded: true,
  error: null,
  runMode: 'devel',
  gpgPath: '',
  socketFile: '',
  serverURI: 'http://localhost:3000',
  label: '',
  path: '',
  gpgExists: false,
  version: '1.0.0-24',
  configPath: ''
}

/*
const initialState = {
  loaded: false,
  error: null
}
*/

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
        loaded: true,
        config: action.config,
        error: null
      }
    default:
      return state
  }
}
