import * as Container from '../util/container'
import * as DevicesGen from '../actions/devices-gen'
import * as ProvisionGen from '../actions/provision-gen'
import * as Types from '../constants/types/devices'
import HiddenString from '../util/hidden-string'

const initialState: Types.State = {
  deviceMap: new Map(),
  endangeredTLFMap: new Map(),
  isNew: new Set(),
  justRevokedSelf: '',
  newPaperkey: new HiddenString(''),
}

export default (
  state: Types.State = initialState,
  action: DevicesGen.Actions | ProvisionGen.StartProvisionPayload
): Types.State =>
  Container.produce(state, (draftState: Container.Draft<Types.State>) => {
    switch (action.type) {
      case DevicesGen.resetStore:
        return initialState
      case DevicesGen.loaded:
        draftState.deviceMap = new Map(action.payload.devices.map(d => [d.deviceID, d]))
        return
      case DevicesGen.endangeredTLFsLoaded: {
        const endangeredTLFMap = new Map(draftState.endangeredTLFMap)
        endangeredTLFMap.set(action.payload.deviceID, new Set(action.payload.tlfs))
        draftState.endangeredTLFMap = endangeredTLFMap
        return
      }
      case DevicesGen.showPaperKeyPage:
        draftState.newPaperkey = initialState.newPaperkey
        return
      case DevicesGen.paperKeyCreated:
        draftState.newPaperkey = action.payload.paperKey
        return
      case DevicesGen.revoked:
        if (action.payload.wasCurrentDevice) {
          draftState.justRevokedSelf = action.payload.deviceName
        }
        return
      case DevicesGen.badgeAppForDevices: {
        const isNew = new Set(state.isNew)
        // We show our badges until we clear with the clearBadges call.
        action.payload.ids.forEach(id => isNew.add(id))
        draftState.isNew = isNew
        return
      }
      case DevicesGen.clearBadges:
        draftState.isNew = initialState.isNew
        return
      case ProvisionGen.startProvision:
        draftState.justRevokedSelf = ''
        return
      // Saga only actions
      case DevicesGen.revoke:
      case DevicesGen.load:
      case DevicesGen.showRevokePage:
      case DevicesGen.showDevicePage:
        return
    }
  })
