// @flow
import * as Constants from '../../constants/search'

function search<T>(
  term: string,
  pendingActionTypeToFire: T,
  finishedActionTypeToFire: T,
  service: Constants.Service = 'Keybase'
): Constants.Search<T> {
  return {
    type: 'search:search',
    payload: {finishedActionTypeToFire, pendingActionTypeToFire, service, term},
  }
}

function searchSuggestions<T>(actionTypeToFire: T, maxUsers?: number = 50): Constants.SearchSuggestions<T> {
  return {type: 'search:searchSuggestions', payload: {actionTypeToFire, maxUsers}}
}

function pendingSearch<T>(actionTypeToFire: T, pending: boolean): Constants.PendingSearch<T> {
  return {type: actionTypeToFire, payload: {pending}}
}

function finishedSearch<T>(
  actionTypeToFire: T,
  searchResults: Array<Constants.SearchResultId>,
  searchResultTerm: string,
  service: Constants.Service = 'Keybase',
  searchShowingSuggestions: boolean = false
): Constants.FinishedSearch<T> {
  return {
    type: actionTypeToFire,
    payload: {searchResultTerm, searchResults, service, searchShowingSuggestions},
  }
}

export {finishedSearch, pendingSearch, search, searchSuggestions}
