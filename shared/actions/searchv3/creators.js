// @flow
import * as Constants from '../../constants/searchv3'
import {List} from 'immutable'

function search<T>(
  term: string,
  actionTypeToFire: T,
  service: Constants.SearchPlatform = 'Keybase'
): Constants.Search<T> {
  return {type: 'searchv3:search', payload: {actionTypeToFire, term, service}}
}

function finishedSearch<T>(
  actionTypeToFire: T,
  searchResults: List<Constants.SearchResultId>,
  searchTerm: string,
  service: Constants.SearchPlatform = 'Keybase'
): Constants.FinishedSearch<T> {
  return {type: actionTypeToFire, payload: {searchTerm, searchResults, service}}
}

export {search, finishedSearch}
