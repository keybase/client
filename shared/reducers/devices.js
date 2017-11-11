// @flow
import * as I from 'immutable'
import * as Constants from '../constants/devices'
import * as DevicesGen from '../actions/devices-gen'

const initialState: Constants.State = Constants.makeState()

export default function(state: Constants.State = initialState, action: DevicesGen.Actions) {
  switch (action.type) {
    case DevicesGen.resetStore:
      return initialState
    case DevicesGen.setWaiting:
      const {waiting} = action.payload
      return state.set('waitingForServer', waiting)
    case DevicesGen.loaded:
      const {deviceIDs} = action.payload
      return state.set('deviceIDs', I.List(deviceIDs))
  }

  return state
}
