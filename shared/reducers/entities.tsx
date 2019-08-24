import * as Types from '../constants/types/entities'
import * as Constants from '../constants/entities'
import * as EntitiesGen from '../actions/entities-gen'

const initialState = Constants.makeState()

export default function(state: Types.State = initialState, action: EntitiesGen.Actions): Types.State {
  switch (action.type) {
    case EntitiesGen.resetStore: {
      return initialState
    }
    case EntitiesGen.deleteEntity: {
      const {keyPath, ids} = action.payload
      return state.updateIn(keyPath, map => map.deleteAll(ids))
    }
    case EntitiesGen.mergeEntity: {
      const {keyPath, entities} = action.payload
      return state.mergeDeepIn(keyPath, entities)
    }
    case EntitiesGen.replaceEntity: {
      const {keyPath, entities} = action.payload
      // @ts-ignore
      return state.mergeIn(keyPath, entities)
    }
    case EntitiesGen.subtractEntity: {
      const {keyPath, entities} = action.payload
      return state.updateIn(keyPath, set => set.subtract(entities))
    }
    default:
      return state
  }
}
