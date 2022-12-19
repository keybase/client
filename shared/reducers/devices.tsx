import * as Container from '../util/container'
import * as DevicesGen from '../actions/devices-gen'
import * as ProvisionGen from '../actions/provision-gen'
import type * as Types from '../constants/types/devices'
import HiddenString from '../util/hidden-string'

const initialState: Types.State = {
  deviceMap: new Map(),
  endangeredTLFMap: new Map(),
  isNew: new Set(),
  justRevokedSelf: '',
  newPaperkey: new HiddenString(''),
}

type Actions = DevicesGen.Actions | ProvisionGen.StartProvisionPayload
export default Container.makeReducer<Actions, Types.State>(initialState, {
  [DevicesGen.resetStore]: () => initialState,
  [DevicesGen.loaded]: (draftState, action) => {
    draftState.deviceMap = new Map(action.payload.devices.map(d => [d.deviceID, d]))
  },
  [DevicesGen.endangeredTLFsLoaded]: (draftState, action) => {
    const {endangeredTLFMap} = draftState
    endangeredTLFMap.set(action.payload.deviceID, new Set(action.payload.tlfs))
  },
  [DevicesGen.showPaperKeyPage]: draftState => {
    draftState.newPaperkey = initialState.newPaperkey
  },
  [DevicesGen.paperKeyCreated]: (draftState, action) => {
    draftState.newPaperkey = action.payload.paperKey
  },
  [DevicesGen.revoked]: (draftState, action) => {
    if (action.payload.wasCurrentDevice) {
      draftState.justRevokedSelf = action.payload.deviceName
    }
  },
  [DevicesGen.badgeAppForDevices]: (draftState, action) => {
    const {isNew} = draftState
    // We show our badges until we clear with the clearBadges call.
    action.payload.ids.forEach(id => isNew.add(id))
  },
  [DevicesGen.clearBadges]: draftState => {
    draftState.isNew = initialState.isNew
  },
  [ProvisionGen.startProvision]: draftState => {
    draftState.justRevokedSelf = ''
  },
})
