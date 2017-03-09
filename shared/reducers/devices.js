// @flow
import * as CommonConstants from '../constants/common'
import HiddenString from '../util/hidden-string'
import {List} from 'immutable'
import {StateRecord, DeviceDetailRecord} from '../constants/devices'

import type {State, Actions} from '../constants/devices'

const initialState: State = new StateRecord()

const updatePaperKey = (state: State, paperKey: ?HiddenString) => state.set('paperKey', paperKey)
const updateWaitingForServer = (state: State, waiting: boolean) => state.set('waitingForServer', waiting)

export default function (state: State = initialState, action: Actions) {
  switch (action.type) {
    case CommonConstants.resetStore:
      return new StateRecord()
    case 'devices:loadingDevices':
    case 'devices:removeDevice': // fallthrough
      return updateWaitingForServer(state, true)
    case 'devices:showDevices':
      const devices = List(action.payload.devices.map(r => new DeviceDetailRecord(r)))
      // $FlowIssue doesn't understand withMutations
      return state.withMutations(s => {
        s.set('devices', devices)
        updateWaitingForServer(s, false)
      })
    case 'devices:deviceRemoved':
      return updateWaitingForServer(state, false)
    case 'devices:paperKeyLoading':
      return updatePaperKey(state, null)
    case 'devices:paperKeyLoaded':
      return updatePaperKey(state, action.payload.paperKey)
    default:
      return state
  }
}
