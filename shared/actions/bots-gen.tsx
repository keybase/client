// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
import * as RPCTypes from '../constants/types/rpc-gen'

// Constants
export const resetStore = 'common:resetStore' // not a part of bots but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'bots:'
export const getFeaturedBots = 'bots:getFeaturedBots'
export const searchFeaturedBots = 'bots:searchFeaturedBots'
export const updateFeaturedBots = 'bots:updateFeaturedBots'

// Payload Types
type _GetFeaturedBotsPayload = {readonly limit: number; readonly offset?: number}
type _SearchFeaturedBotsPayload = {readonly query: string; readonly limit?: number; readonly offset?: number}
type _UpdateFeaturedBotsPayload = {readonly bots: Array<RPCTypes.FeaturedBot>}

// Action Creators
/**
 * Gets featured bots
 */
export const createGetFeaturedBots = (payload: _GetFeaturedBotsPayload): GetFeaturedBotsPayload => ({
  payload,
  type: getFeaturedBots,
})
/**
 * Gets featured bots by query
 */
export const createSearchFeaturedBots = (payload: _SearchFeaturedBotsPayload): SearchFeaturedBotsPayload => ({
  payload,
  type: searchFeaturedBots,
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
export type SearchFeaturedBotsPayload = {
  readonly payload: _SearchFeaturedBotsPayload
  readonly type: typeof searchFeaturedBots
}
export type UpdateFeaturedBotsPayload = {
  readonly payload: _UpdateFeaturedBotsPayload
  readonly type: typeof updateFeaturedBots
}

// All Actions
// prettier-ignore
export type Actions =
  | GetFeaturedBotsPayload
  | SearchFeaturedBotsPayload
  | UpdateFeaturedBotsPayload
  | {type: 'common:resetStore', payload: {}}
