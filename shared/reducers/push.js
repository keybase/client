// @flow
import * as PushGen from '../actions/push-gen'
import * as Types from '../constants/types/push'
import * as Constants from '../constants/push'

const initialState = Constants.makeInitialState()

function reducer(state: Types.State = initialState, action: PushGen.Actions): Types.State {
  switch (action.type) {
    case PushGen.resetStore:
      return initialState
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
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (action: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(action);
      */
      return state
  }
}

export default reducer
