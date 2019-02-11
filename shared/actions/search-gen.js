// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define,import/no-duplicates */

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
export type AddResultsToUserInputPayload = {|+payload: _AddResultsToUserInputPayload, +type: 'search:addResultsToUserInput'|}
export type ClearSearchResultsPayload = {|+payload: _ClearSearchResultsPayload, +type: 'search:clearSearchResults'|}
export type FinishedSearchPayload = {|+payload: _FinishedSearchPayload, +type: 'search:finishedSearch'|}
export type RemoveResultsToUserInputPayload = {|+payload: _RemoveResultsToUserInputPayload, +type: 'search:removeResultsToUserInput'|}
export type SearchPayload = {|+payload: _SearchPayload, +type: 'search:search'|}
export type SearchSuggestionsPayload = {|+payload: _SearchSuggestionsPayload, +type: 'search:searchSuggestions'|}
export type SetUserInputItemsPayload = {|+payload: _SetUserInputItemsPayload, +type: 'search:setUserInputItems'|}
export type UpdateSelectedSearchResultPayload = {|+payload: _UpdateSelectedSearchResultPayload, +type: 'search:updateSelectedSearchResult'|}
export type UserInputItemsUpdatedPayload = {|+payload: _UserInputItemsUpdatedPayload, +type: 'search:userInputItemsUpdated'|}

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
  | {type: 'common:resetStore', payload: null}
