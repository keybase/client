import * as PushGen from '../actions/push-gen'
import * as Types from '../constants/types/push'
import * as Constants from '../constants/push'

const initialState = Constants.makeInitialState()

function reducer(state: Types.State = initialState, action: PushGen.Actions): Types.State {
  switch (action.type) {
    case PushGen.resetStore:
      // when you sign out we need to keep all this info as its per device
      return initialState.merge({
        hasPermissions: state.hasPermissions,
        showPushPrompt: state.showPushPrompt,
        token: state.token,
      })
    case PushGen.rejectPermissions:
      return state.merge({hasPermissions: false, showPushPrompt: false})
    case PushGen.updateHasPermissions:
      return state.merge({hasPermissions: action.payload.hasPermissions})
    case PushGen.showPermissionsPrompt:
      return state.merge({showPushPrompt: action.payload.show})
    case PushGen.updatePushToken:
      return state.merge({token: action.payload.token})
    // Saga only actions
    case PushGen.requestPermissions:
    case PushGen.notification:
      return state
    default:
      return state
  }
}

export default reducer
