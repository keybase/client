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
    case DevicesGen.loaded:
      return state.set('deviceMap', I.Map(action.payload.devices.map(d => [d.deviceID, d])))
    case DevicesGen.endangeredTLFsLoaded:
      return state.setIn(['endangeredTLFMap', action.payload.deviceID], I.Set(action.payload.tlfs))
    case DevicesGen.showRevokePage:
      return state.set('selectedDeviceID', action.payload.deviceID)
    case DevicesGen.showDevicePage:
      return state.set('selectedDeviceID', action.payload.deviceID)
    case DevicesGen.showPaperKeyPage:
      return state.set('newPaperkey', initialState.newPaperkey)
    // Saga only actions
    case DevicesGen.deviceRevoke:
    case DevicesGen.deviceRevoked:
    case DevicesGen.load:
    case DevicesGen.endangeredTLFsLoad:
    case DevicesGen.paperKeyCreated:
      return state
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (action: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(action);
      */
      return state
  }
}
