import * as I from 'immutable'
import * as Constants from '../constants/devices'
import * as Types from '../constants/types/devices'
import * as DevicesGen from '../actions/devices-gen'
import * as ProvisionGen from '../actions/provision-gen'

const initialState: Types.State = Constants.makeState()

export default function(
  state: Types.State = initialState,
  action: DevicesGen.Actions | ProvisionGen.StartProvisionPayload
): Types.State {
  switch (action.type) {
    case DevicesGen.resetStore:
      return initialState
    case DevicesGen.loaded:
      return state.merge({deviceMap: I.Map(action.payload.devices.map(d => [d.deviceID, d]))})
    case DevicesGen.endangeredTLFsLoaded:
      return state.setIn(['endangeredTLFMap', action.payload.deviceID], I.Set(action.payload.tlfs))
    case DevicesGen.showRevokePage:
    case DevicesGen.showDevicePage: // fallthrough
      return state.merge({selectedDeviceID: action.payload.deviceID})
    case DevicesGen.showPaperKeyPage:
      return state.merge({newPaperkey: initialState.newPaperkey})
    case DevicesGen.paperKeyCreated:
      return state.merge({newPaperkey: action.payload.paperKey})
    case DevicesGen.revoked:
      return action.payload.wasCurrentDevice
        ? state.merge({justRevokedSelf: action.payload.deviceName})
        : state
    case DevicesGen.badgeAppForDevices: {
      const newSet = I.Set<string>(action.payload.ids)
      // We show our badges until we clear with the clearBadges call.
      return state.merge({isNew: newSet.merge(state.isNew)})
    }
    case DevicesGen.clearBadges:
      return state.merge({isNew: I.Set()})
    case ProvisionGen.startProvision:
      return state.merge({justRevokedSelf: ''})
    // Saga only actions
    case DevicesGen.revoke:
    case DevicesGen.load:
      return state
    default:
      return state
  }
}
