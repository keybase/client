// @flow
import * as Constants from '../../constants/searchv3'

function search<T>(
  term: string,
  actionTypeToFire: T,
  service: Constants.Service = 'Keybase'
): Constants.Search<T> {
  return {type: 'searchv3:search', payload: {actionTypeToFire, term, service}}
}

function searchSuggestions<T>(actionTypeToFire: T, maxUsers?: number = 10): Constants.SearchSuggestions<T> {
  return {type: 'searchv3:searchSuggestions', payload: {actionTypeToFire, maxUsers}}
}

function finishedSearch<T>(
  actionTypeToFire: T,
  searchResults: Array<Constants.SearchResultId>,
  searchTerm: string,
  service: Constants.Service = 'Keybase'
): Constants.FinishedSearch<T> {
  return {type: actionTypeToFire, payload: {searchTerm, searchResults, service}}
}

export {search, searchSuggestions, finishedSearch}
