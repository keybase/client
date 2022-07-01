// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
import type * as RPCTypes from '../constants/types/rpc-gen'
import type * as Types from '../constants/types/chat2'

// Constants
export const resetStore = 'common:resetStore' // not a part of bots but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'bots:'
export const getFeaturedBots = 'bots:getFeaturedBots'
export const searchFeaturedAndUsers = 'bots:searchFeaturedAndUsers'
export const searchFeaturedBots = 'bots:searchFeaturedBots'
export const setLoadedAllBots = 'bots:setLoadedAllBots'
export const setSearchFeaturedAndUsersResults = 'bots:setSearchFeaturedAndUsersResults'
export const updateFeaturedBots = 'bots:updateFeaturedBots'

// Action Creators
/**
 * Gets featured bots
 */
export const createGetFeaturedBots = (payload: {readonly limit?: number; readonly page?: number} = {}) => ({
  payload,
  type: getFeaturedBots as typeof getFeaturedBots,
})
/**
 * Gets featured bots by query
 */
export const createSearchFeaturedBots = (payload: {
  readonly query: string
  readonly limit?: number
  readonly offset?: number
}) => ({payload, type: searchFeaturedBots as typeof searchFeaturedBots})
/**
 * Searches featured bots and users for add bot screen
 */
export const createSearchFeaturedAndUsers = (payload: {readonly query: string}) => ({
  payload,
  type: searchFeaturedAndUsers as typeof searchFeaturedAndUsers,
})
/**
 * Set results of a search
 */
export const createSetSearchFeaturedAndUsersResults = (payload: {
  readonly query: string
  readonly results?: Types.BotSearchResults
}) => ({payload, type: setSearchFeaturedAndUsersResults as typeof setSearchFeaturedAndUsersResults})
/**
 * Sets a flag if all featured bots have been loaded
 */
export const createSetLoadedAllBots = (payload: {readonly loaded: boolean}) => ({
  payload,
  type: setLoadedAllBots as typeof setLoadedAllBots,
})
/**
 * Updates featured bots in store
 */
export const createUpdateFeaturedBots = (payload: {
  readonly bots: Array<RPCTypes.FeaturedBot>
  readonly page?: number
}) => ({payload, type: updateFeaturedBots as typeof updateFeaturedBots})

// Action Payloads
export type GetFeaturedBotsPayload = ReturnType<typeof createGetFeaturedBots>
export type SearchFeaturedAndUsersPayload = ReturnType<typeof createSearchFeaturedAndUsers>
export type SearchFeaturedBotsPayload = ReturnType<typeof createSearchFeaturedBots>
export type SetLoadedAllBotsPayload = ReturnType<typeof createSetLoadedAllBots>
export type SetSearchFeaturedAndUsersResultsPayload = ReturnType<
  typeof createSetSearchFeaturedAndUsersResults
>
export type UpdateFeaturedBotsPayload = ReturnType<typeof createUpdateFeaturedBots>

// All Actions
// prettier-ignore
export type Actions =
  | GetFeaturedBotsPayload
  | SearchFeaturedAndUsersPayload
  | SearchFeaturedBotsPayload
  | SetLoadedAllBotsPayload
  | SetSearchFeaturedAndUsersResultsPayload
  | UpdateFeaturedBotsPayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
