// @flow
import * as Constants from '../../constants/searchv3'

function search<T>(
  term: string,
  pendingActionTypeToFire: T,
  finishedActionTypeToFire: T,
  service: Constants.Service = 'Keybase'
): Constants.Search<T> {
  return {
    type: 'searchv3:search',
    payload: {finishedActionTypeToFire, pendingActionTypeToFire, service, term},
  }
}

function searchSuggestions<T>(actionTypeToFire: T, maxUsers?: number = 50): Constants.SearchSuggestions<T> {
  return {type: 'searchv3:searchSuggestions', payload: {actionTypeToFire, maxUsers}}
}

function pendingSearch<T>(actionTypeToFire: T, pending: boolean): Constants.PendingSearch<T> {
  return {type: actionTypeToFire, payload: {pending}}
}

function finishedSearch<T>(
  actionTypeToFire: T,
  searchResults: Array<Constants.SearchResultId>,
  searchTerm: string,
  service: Constants.Service = 'Keybase'
): Constants.FinishedSearch<T> {
  return {type: actionTypeToFire, payload: {searchTerm, searchResults, service}}
}

export {finishedSearch, pendingSearch, search, searchSuggestions}
