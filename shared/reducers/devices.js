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
    case DevicesGen.devicesLoaded:
      return action.error ? state : state.set('idToDetail', I.Map(action.payload.idToDetail))
    case DevicesGen.endangeredTLFsLoaded:
      return state.setIn(['idToEndangeredTLFs', action.payload.deviceID], I.Set(action.payload.tlfs))
    // Saga only actions
    case DevicesGen.deviceRevoke:
    case DevicesGen.deviceRevoked:
    case DevicesGen.devicesLoad:
    case DevicesGen.endangeredTLFsLoad:
    case DevicesGen.paperKeyCreated:
    case DevicesGen.paperKeyMake:
    case DevicesGen.showRevokePage:
      return state
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (action: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(action);
      */
      return state
  }
}
