'use strict'

import * as types from '../constants/searchActionTypes'
import Immutable from 'immutable'

const initialState = Immutable.Map()

export default function (state = initialState, action) {
  let update = null

  switch (action.type) {
    case types.INIT_SEARCH:
      update = {
        base: action.base,
        waitingForServer: false,
        term: ''
      }
      break
    case types.SEARCH_RUNNING:
      update = {
        term: action.term,
        results: null,
        error: null,
        waitingForServer: true
      }
      break
    case types.SEARCH_RESULTS:
      update = {
        results: action.results,
        waitingForServer: false,
        error: action.error
      }
      break
    default:
      return state
  }

  // We need to use .set() to keep the object as a key
  return state.mergeDeep(Immutable.Map().set(action.base, Immutable.fromJS(update)))
}
