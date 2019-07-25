import * as Types from '../constants/types/deeplinks'
import * as Constants from '../constants/deeplinks'
import * as DeeplinksGen from '../actions/deeplinks-gen'

const initialState = Constants.makeState()

type Actions =
  | DeeplinksGen.Actions

export default function(state: Types.State = initialState, action: Actions): Types.State {
  switch (action.type) {
    case DeeplinksGen.handleKeybaseLink:
      return state.merge({
        keybaseLinkError: '',
      })
    case DeeplinksGen.setKeybaseLinkError:
      return state.merge({
        keybaseLinkError: action.payload.error,
      })
    // Saga only actions
    case DeeplinksGen.link:
      return state
    default:
      return state
  }
}
