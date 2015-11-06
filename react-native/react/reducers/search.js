/* @flow */
'use strict'

import * as Constants from '../constants/search'
import Immutable from 'immutable'

import type { URI } from './router'

type Base = URI

// TODO settle on some error type and put it in a common type folder
// instead of duplicating this Error type
type Error = string

type SubSearchState = MapADT5<'base', Base, 'waitingForServer', boolean, 'error', ?Error, 'term', string | ''> // eslint-disable-line no-undef
type SearchState = Immutable.Map<Base, SubSearchState>

const initialState: SearchState = Immutable.Map()

export default function (state: SearchState = initialState, action: any): SearchState {
  return state.update(action.base, oldValue => {
    switch (action.type) {
      case Constants.initSearch:
        return Immutable.fromJS({
          base: action.base,
          waitingForServer: false,
          term: '',
          results: []
        })
      case Constants.searchService:
        return oldValue.set('service', action.service)
      case Constants.searchTerm:
        return oldValue.set('term', action.term)
      case Constants.searchRunning:
        return oldValue.merge({
          nonce: action.nonce,
          error: null,
          waitingForServer: true
        })
      case Constants.searchResults:
        return oldValue.merge({
          waitingForServer: false,
          results: action.results,
          error: action.error
        })
    }
  })
}
