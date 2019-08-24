// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import * as Types from '../constants/types/search'

// Constants
export const resetStore = 'common:resetStore' // not a part of search but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'search:'
export const addResultsToUserInput = 'search:addResultsToUserInput'
export const clearSearchResults = 'search:clearSearchResults'
export const finishedSearch = 'search:finishedSearch'
export const removeResultsToUserInput = 'search:removeResultsToUserInput'
export const search = 'search:search'
export const searchSuggestions = 'search:searchSuggestions'
export const setUserInputItems = 'search:setUserInputItems'
export const updateSelectedSearchResult = 'search:updateSelectedSearchResult'
export const userInputItemsUpdated = 'search:userInputItemsUpdated'

// Payload Types
type _AddResultsToUserInputPayload = {
  readonly searchKey: string
  readonly searchResults: Array<Types.SearchResultId>
}
type _ClearSearchResultsPayload = {readonly searchKey: string}
type _FinishedSearchPayload = {
  readonly searchResults: Array<Types.SearchResultId>
  readonly searchResultTerm: string
  readonly service: Types.Service
  readonly searchKey: string
  readonly searchShowingSuggestions?: boolean
}
type _RemoveResultsToUserInputPayload = {
  readonly searchKey: string
  readonly searchResults: Array<Types.SearchResultId>
}
type _SearchPayload = {readonly term: string; readonly service: Types.Service; readonly searchKey: string}
type _SearchSuggestionsPayload = {readonly maxUsers?: number; readonly searchKey: string}
type _SetUserInputItemsPayload = {
  readonly searchKey: string
  readonly searchResults: Array<Types.SearchResultId>
}
type _UpdateSelectedSearchResultPayload = {
  readonly searchKey: string
  readonly id: Types.SearchResultId | null
}
type _UserInputItemsUpdatedPayload = {
  readonly searchKey: string
  readonly userInputItemIds: Array<Types.SearchResultId>
}

// Action Creators
export const createAddResultsToUserInput = (
  payload: _AddResultsToUserInputPayload
): AddResultsToUserInputPayload => ({payload, type: addResultsToUserInput})
export const createClearSearchResults = (payload: _ClearSearchResultsPayload): ClearSearchResultsPayload => ({
  payload,
  type: clearSearchResults,
})
export const createFinishedSearch = (payload: _FinishedSearchPayload): FinishedSearchPayload => ({
  payload,
  type: finishedSearch,
})
export const createRemoveResultsToUserInput = (
  payload: _RemoveResultsToUserInputPayload
): RemoveResultsToUserInputPayload => ({payload, type: removeResultsToUserInput})
export const createSearch = (payload: _SearchPayload): SearchPayload => ({payload, type: search})
export const createSearchSuggestions = (payload: _SearchSuggestionsPayload): SearchSuggestionsPayload => ({
  payload,
  type: searchSuggestions,
})
export const createSetUserInputItems = (payload: _SetUserInputItemsPayload): SetUserInputItemsPayload => ({
  payload,
  type: setUserInputItems,
})
export const createUpdateSelectedSearchResult = (
  payload: _UpdateSelectedSearchResultPayload
): UpdateSelectedSearchResultPayload => ({payload, type: updateSelectedSearchResult})
export const createUserInputItemsUpdated = (
  payload: _UserInputItemsUpdatedPayload
): UserInputItemsUpdatedPayload => ({payload, type: userInputItemsUpdated})

// Action Payloads
export type AddResultsToUserInputPayload = {
  readonly payload: _AddResultsToUserInputPayload
  readonly type: typeof addResultsToUserInput
}
export type ClearSearchResultsPayload = {
  readonly payload: _ClearSearchResultsPayload
  readonly type: typeof clearSearchResults
}
export type FinishedSearchPayload = {
  readonly payload: _FinishedSearchPayload
  readonly type: typeof finishedSearch
}
export type RemoveResultsToUserInputPayload = {
  readonly payload: _RemoveResultsToUserInputPayload
  readonly type: typeof removeResultsToUserInput
}
export type SearchPayload = {readonly payload: _SearchPayload; readonly type: typeof search}
export type SearchSuggestionsPayload = {
  readonly payload: _SearchSuggestionsPayload
  readonly type: typeof searchSuggestions
}
export type SetUserInputItemsPayload = {
  readonly payload: _SetUserInputItemsPayload
  readonly type: typeof setUserInputItems
}
export type UpdateSelectedSearchResultPayload = {
  readonly payload: _UpdateSelectedSearchResultPayload
  readonly type: typeof updateSelectedSearchResult
}
export type UserInputItemsUpdatedPayload = {
  readonly payload: _UserInputItemsUpdatedPayload
  readonly type: typeof userInputItemsUpdated
}

// All Actions
// prettier-ignore
export type Actions =
  | AddResultsToUserInputPayload
  | ClearSearchResultsPayload
  | FinishedSearchPayload
  | RemoveResultsToUserInputPayload
  | SearchPayload
  | SearchSuggestionsPayload
  | SetUserInputItemsPayload
  | UpdateSelectedSearchResultPayload
  | UserInputItemsUpdatedPayload
  | {type: 'common:resetStore', payload: {}}
