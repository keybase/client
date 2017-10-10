// @flow
import * as CommonConstants from '../constants/common'
import {StateRecord} from '../constants/entities'

import type {Actions, State} from '../constants/entities'

const initialState: State = new StateRecord()

export default function(state: State = initialState, action: Actions): State {
  switch (action.type) {
    case CommonConstants.resetStore: {
      return new StateRecord()
    }
    case 'entity:delete': {
      const {keyPath, ids} = action.payload
      // $FlowIssue doesn't understand this API
      // works in immutable 4
      // return state.updateIn(keyPath, map => map.deleteAll(ids))
      return state.updateIn(keyPath, map =>
        map.withMutations(map => {
          ids.forEach(id => {
            map = map.delete(id)
          })
        })
      )
    }
    case 'entity:merge': {
      const {keyPath, entities} = action.payload
      // $FlowIssue doesn't understand this API
      return state.mergeDeepIn(keyPath, entities)
    }
    case 'entity:replace': {
      const {keyPath, entities} = action.payload
      // $FlowIssue doesn't understand this API
      return state.mergeIn(keyPath, entities)
    }
    case 'entity:subtract': {
      const {keyPath, entities} = action.payload
      // $FlowIssue doesn't understand this API
      return state.updateIn(keyPath, set => set.subtract(entities))
    }
    default:
      break
  }

  return state
}
