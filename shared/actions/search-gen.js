// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as More from '../constants/types/more'
import * as Types from '../constants/types/search'

// Constants
export const resetStore = 'common:resetStore' // not a part of search but is handled by every reducer
export const addResultsToUserInput = 'search:addResultsToUserInput'
export const clearSearchResults = 'search:clearSearchResults'
export const finishedSearch = 'search:finishedSearch'
export const removeResultsToUserInput = 'search:removeResultsToUserInput'
export const search = 'search:search'
export const searchSuggestions = 'search:searchSuggestions'
export const setUserInputItems = 'search:setUserInputItems'
export const updateSelectedSearchResult = 'search:updateSelectedSearchResult'
export const userInputItemsUpdated = 'search:userInputItemsUpdated'

// Action Creators
export const createAddResultsToUserInput = (
  payload: $ReadOnly<{|
    searchKey: string,
    searchResults: Array<Types.SearchResultId>,
  |}>
) => ({error: false, payload, type: addResultsToUserInput})
export const createClearSearchResults = (payload: $ReadOnly<{|searchKey: string|}>) => ({error: false, payload, type: clearSearchResults})
export const createFinishedSearch = (
  payload: $ReadOnly<{|
    searchResults: Array<Types.SearchResultId>,
    searchResultTerm: string,
    service: Types.Service,
    searchKey: string,
    searchShowingSuggestions?: boolean,
  |}>
) => ({error: false, payload, type: finishedSearch})
export const createRemoveResultsToUserInput = (
  payload: $ReadOnly<{|
    searchKey: string,
    searchResults: Array<Types.SearchResultId>,
  |}>
) => ({error: false, payload, type: removeResultsToUserInput})
export const createSearch = (
  payload: $ReadOnly<{|
    term: string,
    service: Types.Service,
    searchKey: string,
  |}>
) => ({error: false, payload, type: search})
export const createSearchSuggestions = (
  payload: $ReadOnly<{|
    maxUsers?: number,
    searchKey: string,
  |}>
) => ({error: false, payload, type: searchSuggestions})
export const createSetUserInputItems = (
  payload: $ReadOnly<{|
    searchKey: string,
    searchResults: Array<Types.SearchResultId>,
  |}>
) => ({error: false, payload, type: setUserInputItems})
export const createUpdateSelectedSearchResult = (
  payload: $ReadOnly<{|
    searchKey: string,
    id: ?Types.SearchResultId,
  |}>
) => ({error: false, payload, type: updateSelectedSearchResult})
export const createUserInputItemsUpdated = (
  payload: $ReadOnly<{|
    searchKey: string,
    userInputItemIds: Array<Types.SearchResultId>,
  |}>
) => ({error: false, payload, type: userInputItemsUpdated})

// Action Payloads
export type AddResultsToUserInputPayload = More.ReturnType<typeof createAddResultsToUserInput>
export type ClearSearchResultsPayload = More.ReturnType<typeof createClearSearchResults>
export type FinishedSearchPayload = More.ReturnType<typeof createFinishedSearch>
export type RemoveResultsToUserInputPayload = More.ReturnType<typeof createRemoveResultsToUserInput>
export type SearchPayload = More.ReturnType<typeof createSearch>
export type SearchSuggestionsPayload = More.ReturnType<typeof createSearchSuggestions>
export type SetUserInputItemsPayload = More.ReturnType<typeof createSetUserInputItems>
export type UpdateSelectedSearchResultPayload = More.ReturnType<typeof createUpdateSelectedSearchResult>
export type UserInputItemsUpdatedPayload = More.ReturnType<typeof createUserInputItemsUpdated>

// All Actions
// prettier-ignore
export type Actions =
  | More.ReturnType<typeof createAddResultsToUserInput>
  | More.ReturnType<typeof createClearSearchResults>
  | More.ReturnType<typeof createFinishedSearch>
  | More.ReturnType<typeof createRemoveResultsToUserInput>
  | More.ReturnType<typeof createSearch>
  | More.ReturnType<typeof createSearchSuggestions>
  | More.ReturnType<typeof createSetUserInputItems>
  | More.ReturnType<typeof createUpdateSelectedSearchResult>
  | More.ReturnType<typeof createUserInputItemsUpdated>
  | {type: 'common:resetStore', payload: void}
