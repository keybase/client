// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/chat2'

// Constants
export const resetStore = 'common:resetStore' // not a part of bots but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'bots:'
export const getFeaturedBots = 'bots:getFeaturedBots'
export const searchFeaturedAndUsers = 'bots:searchFeaturedAndUsers'
export const searchFeaturedBots = 'bots:searchFeaturedBots'
export const setLoadedAllBots = 'bots:setLoadedAllBots'
export const setSearchFeaturedAndUsersResults = 'bots:setSearchFeaturedAndUsersResults'
export const updateFeaturedBots = 'bots:updateFeaturedBots'

// Payload Types
type _GetFeaturedBotsPayload = {readonly limit?: number; readonly page?: number}
type _SearchFeaturedAndUsersPayload = {readonly query: string}
type _SearchFeaturedBotsPayload = {readonly query: string; readonly limit?: number; readonly offset?: number}
type _SetLoadedAllBotsPayload = {readonly loaded: boolean}
type _SetSearchFeaturedAndUsersResultsPayload = {
  readonly query: string
  readonly results?: Types.BotSearchResults
}
type _UpdateFeaturedBotsPayload = {readonly bots: Array<RPCTypes.FeaturedBot>; readonly page?: number}

// Action Creators
/**
 * Gets featured bots
 */
export const createGetFeaturedBots = (
  payload: _GetFeaturedBotsPayload = Object.freeze({})
): GetFeaturedBotsPayload => ({payload, type: getFeaturedBots})
/**
 * Gets featured bots by query
 */
export const createSearchFeaturedBots = (payload: _SearchFeaturedBotsPayload): SearchFeaturedBotsPayload => ({
  payload,
  type: searchFeaturedBots,
})
/**
 * Searches featured bots and users for add bot screen
 */
export const createSearchFeaturedAndUsers = (
  payload: _SearchFeaturedAndUsersPayload
): SearchFeaturedAndUsersPayload => ({payload, type: searchFeaturedAndUsers})
/**
 * Set results of a search
 */
export const createSetSearchFeaturedAndUsersResults = (
  payload: _SetSearchFeaturedAndUsersResultsPayload
): SetSearchFeaturedAndUsersResultsPayload => ({payload, type: setSearchFeaturedAndUsersResults})
/**
 * Sets a flag if all featured bots have been loaded
 */
export const createSetLoadedAllBots = (payload: _SetLoadedAllBotsPayload): SetLoadedAllBotsPayload => ({
  payload,
  type: setLoadedAllBots,
})
/**
 * Updates featured bots in store
 */
export const createUpdateFeaturedBots = (payload: _UpdateFeaturedBotsPayload): UpdateFeaturedBotsPayload => ({
  payload,
  type: updateFeaturedBots,
})

// Action Payloads
export type GetFeaturedBotsPayload = {
  readonly payload: _GetFeaturedBotsPayload
  readonly type: typeof getFeaturedBots
}
export type SearchFeaturedAndUsersPayload = {
  readonly payload: _SearchFeaturedAndUsersPayload
  readonly type: typeof searchFeaturedAndUsers
}
export type SearchFeaturedBotsPayload = {
  readonly payload: _SearchFeaturedBotsPayload
  readonly type: typeof searchFeaturedBots
}
export type SetLoadedAllBotsPayload = {
  readonly payload: _SetLoadedAllBotsPayload
  readonly type: typeof setLoadedAllBots
}
export type SetSearchFeaturedAndUsersResultsPayload = {
  readonly payload: _SetSearchFeaturedAndUsersResultsPayload
  readonly type: typeof setSearchFeaturedAndUsersResults
}
export type UpdateFeaturedBotsPayload = {
  readonly payload: _UpdateFeaturedBotsPayload
  readonly type: typeof updateFeaturedBots
}

// All Actions
// prettier-ignore
export type Actions =
  | GetFeaturedBotsPayload
  | SearchFeaturedAndUsersPayload
  | SearchFeaturedBotsPayload
  | SetLoadedAllBotsPayload
  | SetSearchFeaturedAndUsersResultsPayload
  | UpdateFeaturedBotsPayload
  | {type: 'common:resetStore', payload: {}}
