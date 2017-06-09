// @flow
import * as Constants from '../../constants/searchv3'

function search<T>(
  term: string,
  actionTypeToFire: T,
  service: Constants.Service = 'Keybase'
): Constants.Search<T> {
  return {type: 'searchv3:search', payload: {actionTypeToFire, term, service}}
}

function finishedSearch<T>(
  actionTypeToFire: T,
  searchResults: Array<Constants.SearchResultId>,
  searchTerm: string,
  service: Constants.Service = 'Keybase'
): Constants.FinishedSearch<T> {
  return {type: actionTypeToFire, payload: {searchTerm, searchResults, service}}
}

export {search, finishedSearch}
