// @flow
import * as CommonConstants from '../constants/common'
import {List} from 'immutable'
import {StateRecord, DeviceDetailRecord} from '../constants/devices'

import type {State, Actions} from '../constants/devices'

const initialState: State = new StateRecord()

export default function (state: State = initialState, action: Actions) {
  switch (action.type) {
    case CommonConstants.resetStore:
      return new StateRecord()

    case 'devices:loadingDevices':
    case 'devices:removeDevice': // fallthrough
      return {
        ...state,
        waitingForServer: true,
      }
    case 'devices:showDevices':
      const devices = List(action.payload.devices.map(r => new DeviceDetailRecord(r)))
      return {
        ...state,
        devices,
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
