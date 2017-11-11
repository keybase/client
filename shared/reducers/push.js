// @flow
import * as PushGen from '../actions/push-gen'
import * as Constants from '../constants/push'

function reducer(state: Constants.State = Constants.initialState, action: PushGen.Actions): Constants.State {
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
  }
  return state
}

export default reducer
