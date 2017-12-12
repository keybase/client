// @flow
import * as Constants from '../constants/devices'
import * as Types from '../constants/types/devices'
import * as DevicesGen from '../actions/devices-gen'

const initialState: Types.State = Constants.makeState()

export default function(state: Types.State = initialState, action: DevicesGen.Actions) {
  switch (action.type) {
    case DevicesGen.resetStore:
      return initialState
    case DevicesGen.replaceEntity: {
      const {keyPath, entities} = action.payload
      return state.mergeIn(keyPath, entities)
    }
    // Saga only actions
    case DevicesGen.devicesLoad:
    case DevicesGen.devicesLoaded:
    case DevicesGen.endangeredTLFsLoad:
    case DevicesGen.endangeredTLFsLoaded:
    case DevicesGen.paperKeyMake:
    case DevicesGen.revoke:
    case DevicesGen.setWaiting:
    case DevicesGen.showRevokePage:
      return state
    default:
      // eslint-disable-next-line no-unused-expressions
      (action: empty) // if you get a flow error here it means there's an action you claim to handle but didn't
      return state
  }
}
