'use strict'

import * as types from '../constants/searchActionTypes'

const initialState = {}

export default function (state = initialState, action) {
  var existingSearch = state[action.base]

  switch (action.type) {
    case types.INIT_SEARCH:
      return {
        ...state,
        [action.base]: {
          ...existingSearch,
          base: action.base,
          waitingForServer: false,
          term: ''
        }
      }
    case types.SEARCH_RUNNING:
      return {
        ...state,
        [action.base]: {
          ...existingSearch,
          term: action.term,
          results: null,
          error: null,
          waitingForServer: true
        }
      }
    case types.SEARCH_RESULTS:
      return {
        ...state,
        [action.base]: {
          ...existingSearch,
          results: action.results,
          waitingForServer: false,
          error: action.error
        }
      }
    default:
      return state
  }
}
