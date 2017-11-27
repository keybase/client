// @flow
import * as CommonConstants from '../constants/common'
import {makeState} from '../constants/entities'
import {type Actions, type State} from '../constants/types/entities'

const initialState: State = makeState()

export default function(state: State = initialState, action: Actions): State {
  switch (action.type) {
    case CommonConstants.resetStore: {
      return initialState
    }
    case 'entity:delete': {
      const {keyPath, ids} = action.payload
      // $FlowIssue flow can't guarantee the keypath works for all cases
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
      // $FlowIssue flow can't guarantee the keypath works for all cases
      return state.updateIn(keyPath, set => set.subtract(entities))
    }
    default:
      // eslint-disable-next-line no-unused-expressions
      (action: empty) // if you get a flow error here it means there's an action you claim to handle but didn't
      return state
  }
}
