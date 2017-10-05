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
    default:
      break
  }

  return state
}
