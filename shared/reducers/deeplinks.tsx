import * as Types from '../constants/types/deeplinks'
import * as DeeplinksGen from '../actions/deeplinks-gen'
import * as Container from '../util/container'

const initialState: Types.State = {
  keybaseLinkError: '',
}

export default (state: Types.State = initialState, action: DeeplinksGen.Actions): Types.State =>
  Container.produce(state, (draftState: Container.Draft<Types.State>) => {
    switch (action.type) {
      case DeeplinksGen.resetStore:
        return initialState
      case DeeplinksGen.handleKeybaseLink:
        draftState.keybaseLinkError = ''
        return
      case DeeplinksGen.setKeybaseLinkError:
        draftState.keybaseLinkError = action.payload.error
        return
      // Saga only actions
      case DeeplinksGen.link:
        return
    }
  })
