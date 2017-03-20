// @flow
import * as CommonConstants from '../constants/common'
import {StateRecord} from '../constants/entities'

import type {Actions, State} from '../constants/entities'

const initialState: State = new StateRecord()

export default function (state: State = initialState, action: Actions): State {
  switch (action.type) {
    case CommonConstants.resetStore: {
      return new StateRecord()
    }
    case 'entity:delete': {
      const {keyPath, ids} = action.payload
      // TODO with immutable 4.0.0
      // return state.updateIn(keyPath, map => map.deleteAll(ids))
      // $FlowIssue doesn't understand this API
      return state.updateIn(keyPath, map => map.withMutations(map => {
        ids.forEach(id => map.delete(id))
      }))
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
    case 'entity:deleteAll': {
      const {keyPath} = action.payload
      // $FlowIssue doesn't understand this API
      return state.updateIn(keyPath, map => map.clear())
    }
    default:
      break
  }

  return state
}
