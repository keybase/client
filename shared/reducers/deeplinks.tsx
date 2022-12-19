import type * as Types from '../constants/types/deeplinks'
import * as DeeplinksGen from '../actions/deeplinks-gen'
import * as Container from '../util/container'

const initialState: Types.State = {
  keybaseLinkError: '',
}

export default Container.makeReducer<DeeplinksGen.Actions, Types.State>(initialState, {
  [DeeplinksGen.resetStore]: () => initialState,
  [DeeplinksGen.handleKeybaseLink]: draftState => {
    draftState.keybaseLinkError = ''
  },
  [DeeplinksGen.setKeybaseLinkError]: (draftState, action) => {
    draftState.keybaseLinkError = action.payload.error
  },
})
