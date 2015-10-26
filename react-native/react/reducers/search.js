/* @flow */
'use strict'

import * as types from '../constants/search-action-types'
import {Map} from 'immutable'

import type { URI } from './router'

type Base = URI

// TODO settle on some error type and put it in a common type folder
// instead of duplicating this Error type
type Error = string

type SubSearchState = MapADT5<'base', Base, 'waitingForServer', boolean, 'error', ?Error, 'term', string | ''> // eslint-disable-line no-undef
type SearchState = Map<Base, SubSearchState>

const initialState: SearchState = Map()

export default function (state: SearchState = initialState, action: any): SearchState {
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

  return state.update(action.base, Map(), (b) => b.merge(update))
}
