// @flow
import * as PushGen from '../actions/push-gen'
import * as Types from '../constants/types/push'
import * as Constants from '../constants/push'

function reducer(state: Types.State = Constants.initialState, action: PushGen.Actions): Types.State {
  switch (action.type) {
    case PushGen.resetStore:
      return {...Constants.initialState}
    case PushGen.permissionsRequesting:
      const {requesting} = action.payload
      return {
        ...state,
        permissionsRequesting: requesting,
      }
    case PushGen.permissionsPrompt:
      const {prompt} = action.payload
      return {
        ...state,
        permissionsPrompt: prompt,
      }
    case PushGen.updatePushToken:
      const {token, tokenType} = action.payload
      return {
        ...state,
        token,
        tokenType,
      }
    // Saga only actions
    case PushGen.checkIOSPush:
    case PushGen.configurePush:
    case PushGen.error:
    case PushGen.notification:
    case PushGen.permissionsNo:
    case PushGen.permissionsRequest:
    case PushGen.pushToken:
    case PushGen.registrationError:
    case PushGen.savePushToken:
      return state
    default:
      // eslint-disable-next-line no-unused-expressions
      ;(action: empty) // if you get a flow error here it means there's an action you claim to handle but didn't
      return state
  }
}

export default reducer
