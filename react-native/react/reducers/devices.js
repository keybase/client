'use strict'

import * as types from '../constants/devices'

const initialState = {
  waitingForServer: false,
  response: null,
  devices: null,
  error: null,
  paperKey: null
}

export default function (state = initialState, action) {
  switch (action.type) {
    case types.LOADING_DEVICES:
      return {
        ...state,
        error: null,
        waitingForServer: true
      }
    case types.SHOW_DEVICES:
      return {
        ...state,
        error: action.error,
        devices: action.devices,
        waitingForServer: false
      }
    case types.DEVICE_REMOVED:
      return {
        ...state,
        waitingForServer: false
      }
    case types.PAPER_KEY_LOADING:
      return {
        ...state,
        error: null,
        paperKey: null
      }
    case types.PAPER_KEY_LOADED:
      return {
        ...state,
        error: action.error ? action.payload : null,
        paperKey: action.error ? null : action.payload
      }
    default:
      return state
  }
}
