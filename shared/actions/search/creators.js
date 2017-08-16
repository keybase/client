// @flow
import * as Constants from '../../constants/search'

function search<T>(
  term: string,
  pendingActionTypeToFire: T,
  finishedActionTypeToFire: T,
  searchKey: string,
  service: Constants.Service = 'Keybase'
): Constants.Search<T> {
  return {
    type: 'search:search',
    payload: {finishedActionTypeToFire, pendingActionTypeToFire, service, term, searchKey},
  }
}

function searchSuggestions(searchKey: string, maxUsers?: number = 50): Constants.SearchSuggestions {
  return {type: 'search:searchSuggestions', payload: {maxUsers, searchKey}}
}

function pendingSearch<T>(actionTypeToFire: T, pending: boolean): Constants.PendingSearch<T> {
  return {type: actionTypeToFire, payload: {pending}}
}

function finishedSearch(
  searchKey: string,
  searchResults: Array<Constants.SearchResultId>,
  searchResultTerm: string,
  service: Constants.Service = 'Keybase',
  searchShowingSuggestions: boolean = false
): Constants.FinishedSearch {
  return {
    type: 'search:finishedSearch',
    payload: {searchKey, searchResultTerm, searchResults, service, searchShowingSuggestions},
  }
}

function addResultsToUserInput(
  searchKey: string,
  searchResults: Array<Constants.SearchResultId>
): Constants.AddResultsToUserInput {
  return {type: 'search:addResultsToUserInput', payload: {searchKey, searchResults}}
}

function removeResultsToUserInput(
  searchKey: string,
  searchResults: Array<Constants.SearchResultId>
): Constants.RemoveResultsToUserInput {
  return {type: 'search:removeResultsToUserInput', payload: {searchKey, searchResults}}
}

function setUserInputItems(
  searchKey: string,
  searchResults: Array<Constants.SearchResultId>
): Constants.SetUserInputItems {
  return {type: 'search:setUserInputItems', payload: {searchKey, searchResults}}
}

function userInputItemsUpdated(
  searchKey: string,
  ids: Array<Constants.SearchResultId>
): Constants.UserInputItemsUpdated {
  return {type: 'search:userInputItemsUpdated', payload: {searchKey, userInputItemIds: ids}}
}

function addClickedFromUserInput(searchKey: string): Constants.AddClickedFromUserInput {
  return {type: 'search:addClickedFromUserInput', payload: {searchKey}}
}

function clearSearchResults(searchKey: string): Constants.ClearSearchResults {
  return {type: 'search:clearSearchResults', payload: {searchKey}}
}

function updateSelectedSearchResult(
  searchKey: string,
  id: ?Constants.SearchResultId
): Constants.UpdateSelectedSearchResult {
  return {type: 'search:updateSelectedSearchResult', payload: {searchKey, id}}
}

export {
  addClickedFromUserInput,
  addResultsToUserInput,
  clearSearchResults,
  finishedSearch,
  pendingSearch,
  removeResultsToUserInput,
  search,
  searchSuggestions,
  setUserInputItems,
  updateSelectedSearchResult,
  userInputItemsUpdated,
}
