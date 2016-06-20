/* @flow */

import * as Constants from '../constants/search'
import * as CommonConstants from '../constants/common'

import {Map, fromJS} from 'immutable'

import type {URI} from './router'

type Base = URI

// TODO settle on some error type and put it in a common type folder
// instead of duplicating this Error type
type Error = string

type SubSearchState = MapADT5<'base', Base, 'waitingForServer', boolean, 'error', ?Error, 'term', string | ''> // eslint-disable-line no-undef
type SearchState = Map<Base, SubSearchState>

const initialState: SearchState = Map()

export default function (state: SearchState = initialState, action: any): SearchState {
  if (action.type === CommonConstants.resetStore) {
    return initialState.asMutable().asImmutable()
  }

  if (!action.payload || !action.payload.base) {
    return state
  }

  return state.update(action.payload.base, oldValue => {
    switch (action.type) {
      case Constants.initSearch:
        return fromJS({
          base: action.payload.base,
          waitingForServer: false,
          term: '',
          results: [],
        })
      case Constants.searchService:
        return oldValue.set('service', action.payload.service)
      case Constants.searchTerm:
        return oldValue.set('term', action.payload.term)
      case Constants.searchRunning:
        return oldValue.merge({
          nonce: action.payload.nonce,
          error: null,
          waitingForServer: true,
        })
      case Constants.searchResults:
        return oldValue.merge({
          waitingForServer: false,
          results: action.payload.results,
          error: action.payload.error,
        })
    }
  })
}
