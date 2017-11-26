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
  }
  return state
}

export default reducer
