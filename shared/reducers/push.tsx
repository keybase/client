import * as Container from '../util/container'
import * as PushGen from '../actions/push-gen'
import type * as Types from '../constants/types/push'

const initialState: Types.State = {
  hasPermissions: true,
  justSignedUp: false,
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
    if (action.payload.show !== undefined) {
      draftState.showPushPrompt = action.payload.show
    }
    draftState.justSignedUp = !!action.payload.justSignedUp
  },
  [PushGen.updatePushToken]: (draftState, action) => {
    draftState.token = action.payload.token
  },
})
