// @flow
import * as CommonConstants from '../constants/common'
import {List, fromJS} from 'immutable'

import type {State, Actions} from '../constants/devices'

const initialState: State = {
  devices: List(),
  paperKey: null,
  waitingForServer: false,
}

export default function (state: State = initialState, action: Actions) {
  switch (action.type) {
    case CommonConstants.resetStore:
      return {...initialState}

    case 'devices:loadingDevices':
    case 'devices:removeDevice': // fallthrough
      return {
        ...state,
        waitingForServer: true,
      }
    case 'devices:showDevices':
      const {devices} = action.payload
      return {
        ...state,
        devices: fromJS(devices), // TODO record
        waitingForServer: false,
      }
    case 'devices:deviceRemoved':
      return {
        ...state,
        waitingForServer: false,
      }
    case 'devices:paperKeyLoading':
      return {
        ...state,
        paperKey: null,
      }
    case 'devices:paperKeyLoaded':
      const {paperKey} = action.payload
      return {
        ...state,
        paperKey,
      }
    default:
      return state
  }
}
