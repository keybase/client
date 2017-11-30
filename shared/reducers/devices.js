// @flow
import * as I from 'immutable'
import * as Constants from '../constants/devices'
import * as Types from '../constants/types/devices'
import * as DevicesGen from '../actions/devices-gen'

const initialState: Types.State = Constants.makeState()

export default function(state: Types.State = initialState, action: DevicesGen.Actions) {
  switch (action.type) {
    case DevicesGen.resetStore:
      return initialState
    case DevicesGen.setWaiting:
      const {waiting} = action.payload
      return state.set('waitingForServer', waiting)
    case DevicesGen.loaded:
      const {deviceIDs} = action.payload
      return state.set('deviceIDs', I.List(deviceIDs))
    // Saga only actions
    case DevicesGen.load:
    case DevicesGen.paperKeyMake:
    case DevicesGen.revoke:
    case DevicesGen.showRevokePage:
      return state
    default:
      // eslint-disable-next-line no-unused-expressions
      (action: empty) // if you get a flow error here it means there's an action you claim to handle but didn't
      return state
  }
}
