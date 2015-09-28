'use strict'

import * as types from '../constants/devicesActionTypes'

const initialState = {
  waitingForServer: false,
  response: null,
  devices: null,
  error: null
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
    default:
      return state
  }
}
