import * as Container from '../util/container'
import * as PushGen from '../actions/push-gen'
import * as Types from '../constants/types/push'

const initialState: Types.State = {
  hasPermissions: true,
  justProvisioned: false,
  showPushPrompt: false,
  token: '',
}

export default Container.makeReducer<PushGen.Actions, Types.State>(initialState, {
  // when you sign out we need to keep all this info as its per device
  [PushGen.resetStore]: () => {},
  [PushGen.rejectPermissions]: draftState => {
    draftState.hasPermissions = false
    draftState.showPushPrompt = false
  },
  [PushGen.updateHasPermissions]: (draftState, action) => {
    draftState.hasPermissions = action.payload.hasPermissions
  },
  [PushGen.showPermissionsPrompt]: (draftState, action) => {
    draftState.justProvisioned = !!action.payload.justProvisioned
    draftState.showPushPrompt = action.payload.show
  },
  [PushGen.updatePushToken]: (draftState, action) => {
    draftState.token = action.payload.token
  },
})
