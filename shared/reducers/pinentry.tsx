import * as Types from '../constants/types/pinentry'
import * as Constants from '../constants/pinentry'
import * as PinentryGen from '../actions/pinentry-gen'

const initialState: Types.State = Constants.makeState()

export default function(state: Types.State = initialState, action: PinentryGen.Actions): Types.State {
  switch (action.type) {
    case PinentryGen.resetStore:
      return initialState
    case PinentryGen.deleteEntity: {
      const {keyPath, ids} = action.payload
      return state.updateIn(keyPath, map => map.deleteAll(ids))
    }
    case PinentryGen.mergeEntity: {
      const {keyPath, entities} = action.payload
      return state.mergeDeepIn(keyPath, entities)
    }
    case PinentryGen.replaceEntity: {
      const {keyPath, entities} = action.payload
      // @ts-ignore
      return state.mergeIn(keyPath, entities)
    }
    case PinentryGen.subtractEntity: {
      const {keyPath, entities} = action.payload
      return state.updateIn(keyPath, set => set.subtract(entities))
    }
    // Saga only actions
    case PinentryGen.newPinentry:
    case PinentryGen.onCancel:
    case PinentryGen.onSubmit:
      return state
    default:
      return state
  }
}
