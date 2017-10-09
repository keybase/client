// @flow
import * as CommonConstants from '../constants/common'
import {makeState, type Actions, type State} from '../constants/entities'

const initialState: State = makeState()

export default function(state: State = initialState, action: Actions): State {
  switch (action.type) {
    case CommonConstants.resetStore: {
      return initialState
    }
    case 'entity:delete': {
      const {keyPath, ids} = action.payload
      return state.updateIn(keyPath, map => map.deleteAll(ids))
    }
    case 'entity:merge': {
      const {keyPath, entities} = action.payload
      return state.mergeDeepIn(keyPath, entities)
    }
    case 'entity:replace': {
      const {keyPath, entities} = action.payload
      return state.mergeIn(keyPath, entities)
    }
    case 'entity:subtract': {
      const {keyPath, entities} = action.payload
      return state.updateIn(keyPath, set => set.subtract(entities))
    }
    default:
      break
  }

  return state
}
