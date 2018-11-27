// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
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
type _AddResultsToUserInputPayload = $ReadOnly<{|searchKey: string, searchResults: Array<Types.SearchResultId>|}>
type _ClearSearchResultsPayload = $ReadOnly<{|searchKey: string|}>
type _FinishedSearchPayload = $ReadOnly<{|searchResults: Array<Types.SearchResultId>, searchResultTerm: string, service: Types.Service, searchKey: string, searchShowingSuggestions?: boolean|}>
type _RemoveResultsToUserInputPayload = $ReadOnly<{|searchKey: string, searchResults: Array<Types.SearchResultId>|}>
type _SearchPayload = $ReadOnly<{|term: string, service: Types.Service, searchKey: string|}>
type _SearchSuggestionsPayload = $ReadOnly<{|maxUsers?: number, searchKey: string|}>
type _SetUserInputItemsPayload = $ReadOnly<{|searchKey: string, searchResults: Array<Types.SearchResultId>|}>
type _UpdateSelectedSearchResultPayload = $ReadOnly<{|searchKey: string, id: ?Types.SearchResultId|}>
type _UserInputItemsUpdatedPayload = $ReadOnly<{|searchKey: string, userInputItemIds: Array<Types.SearchResultId>|}>

// Action Creators
export const createAddResultsToUserInput = (payload: _AddResultsToUserInputPayload) => ({payload, type: addResultsToUserInput})
export const createClearSearchResults = (payload: _ClearSearchResultsPayload) => ({payload, type: clearSearchResults})
export const createFinishedSearch = (payload: _FinishedSearchPayload) => ({payload, type: finishedSearch})
export const createRemoveResultsToUserInput = (payload: _RemoveResultsToUserInputPayload) => ({payload, type: removeResultsToUserInput})
export const createSearch = (payload: _SearchPayload) => ({payload, type: search})
export const createSearchSuggestions = (payload: _SearchSuggestionsPayload) => ({payload, type: searchSuggestions})
export const createSetUserInputItems = (payload: _SetUserInputItemsPayload) => ({payload, type: setUserInputItems})
export const createUpdateSelectedSearchResult = (payload: _UpdateSelectedSearchResultPayload) => ({payload, type: updateSelectedSearchResult})
export const createUserInputItemsUpdated = (payload: _UserInputItemsUpdatedPayload) => ({payload, type: userInputItemsUpdated})

// Action Payloads
export type AddResultsToUserInputPayload = $Call<typeof createAddResultsToUserInput, _AddResultsToUserInputPayload>
export type ClearSearchResultsPayload = $Call<typeof createClearSearchResults, _ClearSearchResultsPayload>
export type FinishedSearchPayload = $Call<typeof createFinishedSearch, _FinishedSearchPayload>
export type RemoveResultsToUserInputPayload = $Call<typeof createRemoveResultsToUserInput, _RemoveResultsToUserInputPayload>
export type SearchPayload = $Call<typeof createSearch, _SearchPayload>
export type SearchSuggestionsPayload = $Call<typeof createSearchSuggestions, _SearchSuggestionsPayload>
export type SetUserInputItemsPayload = $Call<typeof createSetUserInputItems, _SetUserInputItemsPayload>
export type UpdateSelectedSearchResultPayload = $Call<typeof createUpdateSelectedSearchResult, _UpdateSelectedSearchResultPayload>
export type UserInputItemsUpdatedPayload = $Call<typeof createUserInputItemsUpdated, _UserInputItemsUpdatedPayload>

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
  | {type: 'common:resetStore', payload: void}
